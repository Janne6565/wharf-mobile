import ExpoModulesCore
import Foundation
import WharfSshEngine

// Native iOS bridge for the `WharfSsh` Expo module: a thin wrapper over the
// gomobile-compiled Wharf SSH engine (WharfSshEngine.xcframework, package
// `sshengine`). It owns a single engine instance, forwards the JS AsyncFunctions
// to the engine, and relays the engine's callbacks back as Expo events.
//
// Two threading rules from the engine author are load-bearing here (see the
// package doc in sshengine/engine.go):
//
//   1. `Engine.Connect` BLOCKS until the shell is up or the attempt fails. It must
//      run on a background thread — never the main thread, and never Expo's default
//      per-module AsyncFunction queue (blocking that queue would also stall
//      cancelConnect, which is exactly what unblocks a pending Connect). So Connect
//      is dispatched onto a dedicated concurrent queue and the promise is resolved
//      from there.
//   2. Every `Callbacks` method fires SYNCHRONOUSLY on an internal Go goroutine and
//      must return promptly — a slow OnData applies back-pressure to the SSH
//      channel. The callback handler therefore does the bare minimum inline
//      (base64-encode) and hops onto a serial queue to call `sendEvent`, so the Go
//      goroutine is released immediately.

// Serial queue every engine callback hops onto before touching Expo. Serial so
// OnData events for a session keep their order; off the Go goroutine so the SSH
// channel is never back-pressured by event delivery.
private let sshCallbackQueue = DispatchQueue(label: "de.jannekeipert.wharf.ssh.callbacks")

// Dedicated queue for the BLOCKING engine.Connect. Concurrent so several hosts can
// be dialled at once, and independent of Expo's module queue so an in-flight
// Connect never blocks cancelConnect / write / resize / close.
private let sshConnectQueue = DispatchQueue(
  label: "de.jannekeipert.wharf.ssh.connect", attributes: .concurrent)

// Options for `connect`, marshalled from the single JS object argument. Field
// names mirror the frozen SshConnectOptions contract (modules/wharf-ssh/contract.ts).
struct SshConnectOptionsRecord: Record {
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
}

// SshCallbackHandler implements the engine's Callbacks protocol. It captures a
// weak reference to the owning module (so it never keeps the module alive) and
// forwards each callback as an Expo event from the serial callback queue. The
// event bodies carry EXACTLY the field names the TS layer expects.
private final class SshCallbackHandler: NSObject, SshengineCallbacksProtocol {
  private let emit: (String, [String: Any]) -> Void

  init(emit: @escaping (String, [String: Any]) -> Void) {
    self.emit = emit
  }

  func onData(_ sessionID: String?, data: Data?) {
    let sessionId = sessionID ?? ""
    // Base64-encode inline (cheap) so the Go-owned Data copy is consumed before we
    // return control to the goroutine; the async hop only carries a String.
    let dataB64 = (data ?? Data()).base64EncodedString()
    sshCallbackQueue.async { [emit] in
      emit("onData", ["sessionId": sessionId, "dataB64": dataB64])
    }
  }

  func onClosed(_ sessionID: String?, errMsg: String?) {
    let sessionId = sessionID ?? ""
    // errMsg is "" on a clean close, otherwise a "<code>: <detail>" string the JS
    // parseSshErrorCode reads — forwarded verbatim.
    let error = errMsg ?? ""
    sshCallbackQueue.async { [emit] in
      emit("onClosed", ["sessionId": sessionId, "error": error])
    }
  }

  func onHostKeyPrompt(
    _ promptID: String?, sessionID: String?, host: String?, keyType: String?,
    fingerprint: String?
  ) {
    let body: [String: Any] = [
      "promptId": promptID ?? "",
      "sessionId": sessionID ?? "",
      "host": host ?? "",
      "keyType": keyType ?? "",
      "fingerprint": fingerprint ?? "",
    ]
    sshCallbackQueue.async { [emit] in
      emit("onHostKeyPrompt", body)
    }
  }

  func onSecretPrompt(
    _ promptID: String?, sessionID: String?, kind: String?, prompt: String?, echo: Bool
  ) {
    let body: [String: Any] = [
      "promptId": promptID ?? "",
      "sessionId": sessionID ?? "",
      "kind": kind ?? "",
      "prompt": prompt ?? "",
      "echo": echo,
    ]
    sshCallbackQueue.async { [emit] in
      emit("onSecretPrompt", body)
    }
  }
}

public class WharfSshModule: Module {
  // A single engine, created lazily on the first connect (its knownHostsPath comes
  // per-connect from JS but is constant for the app sandbox). Guarded by a lock
  // because connect can arrive concurrently on the connect queue.
  private var engine: SshengineEngine?
  private var handler: SshCallbackHandler?
  private let engineLock = NSLock()

  public func definition() -> ModuleDefinition {
    Name("WharfSsh")
    Events("onData", "onClosed", "onHostKeyPrompt", "onSecretPrompt")

    AsyncFunction("connect") { (options: SshConnectOptionsRecord, promise: Promise) in
      let engine: SshengineEngine
      do {
        engine = try self.ensureEngine(knownHostsPath: options.knownHostsPath)
      } catch {
        promise.reject(SshEngineException(error.localizedDescription))
        return
      }
      // Run the BLOCKING Connect off the Expo module queue (see file header).
      sshConnectQueue.async {
        do {
          try engine.connect(
            options.sessionId, host: options.host, port: options.port, user: options.user,
            storedPassword: options.storedPassword, termType: options.termType,
            cols: options.cols, rows: options.rows, timeoutMs: options.timeoutMs)
          promise.resolve(nil)
        } catch {
          // Reject with the engine's message VERBATIM: it is a "<code>: <detail>"
          // string and the JS parseSshErrorCode recovers the code from the leading
          // token. The Expo error-code field is secondary to this message.
          promise.reject("ERR_SSH_CONNECT", error.localizedDescription)
        }
      }
    }

    AsyncFunction("probe") { (host: String, port: Int, timeoutMs: Int, promise: Promise) in
      // SshengineProbe BLOCKS up to timeoutMs on the TCP dial, so run it off the
      // Expo module queue (like connect) and resolve from the connect queue. It is
      // a stateless package function — no engine instance is needed.
      sshConnectQueue.async {
        let rtt = SshengineProbe(host, port, timeoutMs)
        promise.resolve(rtt)
      }
    }

    AsyncFunction("cancelConnect") { (sessionId: String) in
      // No-op if no engine yet: there can be no in-flight connect without one.
      self.currentEngine()?.cancelConnect(sessionId)
    }

    AsyncFunction("write") { (sessionId: String, dataB64: String) in
      guard let data = Data(base64Encoded: dataB64) else {
        throw InvalidBase64Exception()
      }
      guard let engine = self.currentEngine() else {
        throw NoSessionException()
      }
      do {
        try engine.write(sessionId, data: data)
      } catch {
        throw SshEngineException(error.localizedDescription)
      }
    }

    AsyncFunction("resize") { (sessionId: String, cols: Int, rows: Int) in
      guard let engine = self.currentEngine() else {
        throw NoSessionException()
      }
      do {
        try engine.resize(sessionId, cols: cols, rows: rows)
      } catch {
        throw SshEngineException(error.localizedDescription)
      }
    }

    AsyncFunction("snapshot") { (sessionId: String) -> String in
      // Unknown session (or no engine) → empty snapshot, mirroring the engine's
      // nil-for-unknown contract.
      guard let engine = self.currentEngine(),
        let data = engine.snapshot(sessionId)
      else {
        return ""
      }
      return data.base64EncodedString()
    }

    AsyncFunction("close") { (sessionId: String) in
      self.currentEngine()?.close(sessionId)
    }

    AsyncFunction("closeAll") {
      self.currentEngine()?.closeAll()
    }

    AsyncFunction("resolveHostKeyPrompt") { (promptId: String, accept: Bool) in
      self.currentEngine()?.resolveHostKeyPrompt(promptId, accept: accept)
    }

    AsyncFunction("resolveSecretPrompt") { (promptId: String, secretB64: String?) in
      // null (nil) cancels authentication — forward nil bytes to the engine.
      let secret: Data? = secretB64.flatMap { Data(base64Encoded: $0) }
      self.currentEngine()?.resolveSecretPrompt(promptId, secret: secret)
    }

    // Free every live session when the module is torn down (dev reload / app exit)
    // so no SSH goroutine is left running.
    OnDestroy {
      self.currentEngine()?.closeAll()
    }
  }

  // currentEngine returns the engine if one has been created, without creating it.
  private func currentEngine() -> SshengineEngine? {
    engineLock.lock()
    defer { engineLock.unlock() }
    return engine
  }

  // ensureEngine returns the single engine, creating it on first use with the
  // caller's knownHostsPath.
  //
  // Constraint: the path is captured once, at creation. It is constant for the app
  // sandbox, so a later connect passing a different path keeps the existing engine
  // (recreating would orphan every live session). If per-connect known-hosts files
  // are ever needed, the engine would have to be reworked to take the path per call.
  private func ensureEngine(knownHostsPath: String) throws -> SshengineEngine {
    engineLock.lock()
    defer { engineLock.unlock() }
    if let engine = engine {
      return engine
    }
    let handler = SshCallbackHandler(emit: { [weak self] name, body in
      self?.sendEvent(name, body)
    })
    guard let created = SshengineNewEngine(knownHostsPath, handler) else {
      throw SshEngineException("failed to create SSH engine")
    }
    self.handler = handler
    self.engine = created
    return created
  }
}

// Carries a dynamic message (e.g. a verbatim engine error) to JS as the rejection
// reason; parseSshErrorCode reads this text.
private final class SshEngineException: GenericException<String> {
  override var reason: String { param }
}

private final class InvalidBase64Exception: Exception {
  override var reason: String {
    "data was not valid base64"
  }
}

private final class NoSessionException: Exception {
  override var reason: String {
    "no active SSH engine / session"
  }
}
