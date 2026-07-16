import Argon2Swift
import ExpoModulesCore
import Foundation

// Native argon2id for the Wharf vault. Takes the secret and salt as raw bytes
// (base64 over the bridge) so a binary recovery secret is hashed exactly, and
// honours the parallelism parameter that libsodium's high-level pwhash cannot.
public class WharfArgon2Module: Module {
  public func definition() -> ModuleDefinition {
    Name("WharfArgon2")

    AsyncFunction("argon2idRaw") {
      (
        passwordBase64: String,
        saltBase64: String,
        iterations: Int,
        memoryKiB: Int,
        parallelism: Int,
        hashLength: Int
      ) throws -> String in
      guard let password = Data(base64Encoded: passwordBase64),
        let saltData = Data(base64Encoded: saltBase64)
      else {
        throw InvalidBase64Exception()
      }

      let result = try Argon2Swift.hashPasswordBytes(
        password: password,
        salt: Salt(bytes: saltData),
        iterations: iterations,
        memory: memoryKiB,
        parallelism: parallelism,
        length: hashLength,
        type: .id,
        version: .V13
      )
      return result.base64String()
    }
  }
}

private final class InvalidBase64Exception: Exception {
  override var reason: String {
    "password or salt was not valid base64"
  }
}
