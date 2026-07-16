package expo.modules.wharfargon2

import android.util.Base64
import com.lambdapioneer.argon2kt.Argon2Kt
import com.lambdapioneer.argon2kt.Argon2Mode
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Native argon2id for the Wharf vault. Takes the secret and salt as raw bytes
// (base64 over the bridge) so a binary recovery secret is hashed exactly, and
// honours the parallelism parameter that libsodium's high-level pwhash cannot.
class WharfArgon2Module : Module() {
  private val argon2Kt by lazy { Argon2Kt() }

  override fun definition() = ModuleDefinition {
    Name("WharfArgon2")

    AsyncFunction("argon2idRaw") {
      passwordBase64: String,
      saltBase64: String,
      iterations: Int,
      memoryKiB: Int,
      parallelism: Int,
      hashLength: Int ->
      try {
        val password = Base64.decode(passwordBase64, Base64.NO_WRAP)
        val salt = Base64.decode(saltBase64, Base64.NO_WRAP)
        val result = argon2Kt.hash(
          mode = Argon2Mode.ARGON2_ID,
          password = password,
          salt = salt,
          tCostInIterations = iterations,
          mCostInKibibyte = memoryKiB,
          parallelism = parallelism,
          hashLengthInBytes = hashLength,
        )
        Base64.encodeToString(result.rawHashAsByteArray(), Base64.NO_WRAP)
      } catch (e: Exception) {
        throw Argon2Exception(e)
      }
    }
  }
}

private class Argon2Exception(cause: Throwable) :
  CodedException("ERR_WHARF_ARGON2", "argon2id derivation failed: ${cause.message}", cause)
