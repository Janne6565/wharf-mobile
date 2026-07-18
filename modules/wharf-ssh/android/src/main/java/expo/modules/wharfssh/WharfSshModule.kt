package expo.modules.wharfssh

import android.util.Base64
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.util.concurrent.Executors
import sshengine.Callbacks
import sshengine.Engine
import sshengine.Sshengine

// Native Android bridge for the `WharfSsh` Expo module: a thin wrapper over the
// gomobile-compiled Wharf SSH engine (sshengine.aar, package `sshengine`). Mirrors
// the iOS module (modules/wharf-ssh/ios/WharfSshModule.swift). See that file and
// sshengine/engine.go for the full threading contract; the two load-bearing rules:
//
//   1. Engine.connect BLOCKS until the shell is up or the attempt fails. It runs on
//      a dedicated executor, never on Expo's module thread — blocking that thread
//      would also stall cancelConnect, which is what unblocks a pending connect.
//   2. Every Callbacks method fires SYNCHRONOUSLY on an internal Go thread and must
//      return promptly (a slow onData back-pressures the SSH channel). The handler
//      base64-encodes inline and hops onto a serial executor to sendEvent, freeing
//      the Go thread immediately.

// Serial executor every engine callback hops onto before touching Expo — serial so
// a session's onData events keep their order, off the Go thread so the SSH channel
// is never back-pressured by event delivery.
private val callbackExecutor = Executors.newSingleThreadExecutor()

// Executor for the BLOCKING connect. Cached pool so several hosts can be dialled at
// once, independent of Expo's module thread.
private val connectExecutor = Executors.newCachedThreadPool()

// Options for `connect`, marshalled from the single JS object argument. Field names
// mirror the frozen SshConnectOptions contract (modules/wharf-ssh/contract.ts).
class SshConnectOptionsRecord : Record {
  @Field var sessionId: String = ""
  @Field var host: String = ""
  @Field var port: Int = 0
  @Field var user: String = ""
  @Field var storedPassword: String = ""
  @Field var termType: String = ""
  @Field var cols: Int = 0
  @Field var rows: Int = 0
  @Field var timeoutMs: Int = 0
  @Field var knownHostsPath: String = ""
  // Key-mode auth. Defaulted so an older JS bundle (which sends neither field)
  // stays safe: "password" keeps the legacy password-first chain, and "" is an
  // empty keysJSON array. The JS wrapper serializes `keys` into `keysJson`.
  @Field var authMethod: String = "password"
  @Field var keysJson: String = ""
}

class WharfSshModule : Module() {
  // A single engine, created lazily on the first connect (its knownHostsPath comes
  // per-connect from JS but is constant for the app sandbox). Guarded because
  // connect can arrive concurrently on the connect executor.
  private var engine: Engine? = null
  private val engineLock = Any()

  override fun definition() = ModuleDefinition {
    Name("WharfSsh")
    Events("onData", "onClosed", "onHostKeyPrompt", "onSecretPrompt")

    AsyncFunction("connect") { options: SshConnectOptionsRecord, promise: Promise ->
      val engine: Engine
      try {
        engine = ensureEngine(options.knownHostsPath)
      } catch (e: Exception) {
        promise.reject(SshEngineException(e.message ?: "failed to create SSH engine", e))
        return@AsyncFunction
      }
      // Run the BLOCKING connect off Expo's module thread (see file header).
      connectExecutor.execute {
        try {
          // authMethod + keysJson are the key-mode params added to the engine's
          // Connect; they resolve only against a rebuilt sshengine.aar (the aar is
          // NDK-gated and not committed, so this file compiles once the engine is
          // rebuilt locally — same gating as before, see libs/.gitignore).
          engine.connect(
            options.sessionId, options.host, options.port.toLong(), options.user,
            options.storedPassword, options.termType, options.authMethod, options.keysJson,
            options.cols.toLong(), options.rows.toLong(), options.timeoutMs.toLong())
          promise.resolve(null)
        } catch (e: Exception) {
          // Reject with the engine's message VERBATIM: it is a "<code>: <detail>"
          // string and the JS parseSshErrorCode recovers the code from the leading
          // token. The Expo error-code field is secondary to this message.
          promise.reject(
            CodedException("ERR_SSH_CONNECT", e.message ?: "unknown connect error", e))
        }
      }
    }

    AsyncFunction("probe") { host: String, port: Int, timeoutMs: Int, promise: Promise ->
      // Sshengine.probe BLOCKS up to timeoutMs on the TCP dial, so run it off
      // Expo's module thread (like connect) and resolve from the connect executor.
      // It is a stateless package function — no engine instance is needed.
      connectExecutor.execute {
        val rtt = Sshengine.probe(host, port.toLong(), timeoutMs.toLong())
        promise.resolve(rtt)
      }
    }

    AsyncFunction("cancelConnect") { sessionId: String ->
      // No-op if no engine yet: there can be no in-flight connect without one.
      currentEngine()?.cancelConnect(sessionId)
    }

    AsyncFunction("write") { sessionId: String, dataB64: String ->
      val data =
        try {
          Base64.decode(dataB64, Base64.NO_WRAP)
        } catch (e: IllegalArgumentException) {
          throw InvalidBase64Exception(e)
        }
      val engine = currentEngine() ?: throw NoSessionException()
      try {
        engine.write(sessionId, data)
      } catch (e: Exception) {
        throw SshEngineException(e.message ?: "write failed", e)
      }
    }

    AsyncFunction("resize") { sessionId: String, cols: Int, rows: Int ->
      val engine = currentEngine() ?: throw NoSessionException()
      try {
        engine.resize(sessionId, cols.toLong(), rows.toLong())
      } catch (e: Exception) {
        throw SshEngineException(e.message ?: "resize failed", e)
      }
    }

    AsyncFunction("snapshot") { sessionId: String ->
      // Unknown session (or no engine) → empty snapshot, mirroring the engine's
      // nil-for-unknown contract.
      val data = currentEngine()?.snapshot(sessionId)
      if (data == null || data.isEmpty()) "" else Base64.encodeToString(data, Base64.NO_WRAP)
    }

    AsyncFunction("close") { sessionId: String ->
      currentEngine()?.close(sessionId)
    }

    AsyncFunction("closeAll") {
      currentEngine()?.closeAll()
    }

    AsyncFunction("resolveHostKeyPrompt") { promptId: String, accept: Boolean ->
      currentEngine()?.resolveHostKeyPrompt(promptId, accept)
    }

    AsyncFunction("resolveSecretPrompt") { promptId: String, secretB64: String? ->
      // null cancels authentication — forward null bytes to the engine.
      val secret = secretB64?.let { Base64.decode(it, Base64.NO_WRAP) }
      currentEngine()?.resolveSecretPrompt(promptId, secret)
    }

    // Free every live session when the module is torn down (dev reload / app exit)
    // so no SSH goroutine is left running.
    OnDestroy {
      currentEngine()?.closeAll()
    }
  }

  // currentEngine returns the engine if one has been created, without creating it.
  private fun currentEngine(): Engine? = synchronized(engineLock) { engine }

  // ensureEngine returns the single engine, creating it on first use with the
  // caller's knownHostsPath.
  //
  // Constraint: the path is captured once, at creation. It is constant for the app
  // sandbox, so a later connect passing a different path keeps the existing engine
  // (recreating would orphan every live session).
  private fun ensureEngine(knownHostsPath: String): Engine =
    synchronized(engineLock) {
      engine?.let {
        return it
      }
      // The handler forwards each callback as an Expo event from the serial
      // callback executor; base64 encoding happens inline on the Go thread.
      val handler =
        object : Callbacks {
          override fun onData(sessionID: String, data: ByteArray) {
            val dataB64 = Base64.encodeToString(data, Base64.NO_WRAP)
            callbackExecutor.execute {
              sendEvent("onData", mapOf("sessionId" to sessionID, "dataB64" to dataB64))
            }
          }

          override fun onClosed(sessionID: String, errMsg: String) {
            // errMsg is "" on a clean close, otherwise a "<code>: <detail>" string
            // the JS parseSshErrorCode reads — forwarded verbatim.
            callbackExecutor.execute {
              sendEvent("onClosed", mapOf("sessionId" to sessionID, "error" to errMsg))
            }
          }

          override fun onHostKeyPrompt(
            promptID: String, sessionID: String, host: String, keyType: String,
            fingerprint: String
          ) {
            val body =
              mapOf(
                "promptId" to promptID,
                "sessionId" to sessionID,
                "host" to host,
                "keyType" to keyType,
                "fingerprint" to fingerprint)
            callbackExecutor.execute { sendEvent("onHostKeyPrompt", body) }
          }

          override fun onSecretPrompt(
            promptID: String, sessionID: String, kind: String, prompt: String, echo: Boolean
          ) {
            val body =
              mapOf(
                "promptId" to promptID,
                "sessionId" to sessionID,
                "kind" to kind,
                "prompt" to prompt,
                "echo" to echo)
            callbackExecutor.execute { sendEvent("onSecretPrompt", body) }
          }
        }
      val created =
        Sshengine.newEngine(knownHostsPath, handler)
          ?: throw SshEngineException("failed to create SSH engine", null)
      engine = created
      return created
    }
}

// Carries a dynamic message (e.g. a verbatim engine error) to JS as the rejection
// message; parseSshErrorCode reads this text.
private class SshEngineException(message: String, cause: Throwable?) :
  CodedException("ERR_WHARF_SSH", message, cause)

private class InvalidBase64Exception(cause: Throwable) :
  CodedException("ERR_WHARF_SSH_BASE64", "data was not valid base64", cause)

private class NoSessionException :
  CodedException("ERR_WHARF_SSH_NO_SESSION", "no active SSH engine / session", null)
