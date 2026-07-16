// Crypto error taxonomy. Mirrors the Go vault's error semantics: a wrong
// password and a wrong recovery code are indistinguishable ("wrong secret"),
// while a structurally broken or tampered blob is "corrupt".

export type CryptoErrorCode = "wrong-secret" | "corrupt" | "malformed-code";

export class CryptoError extends Error {
  readonly code: CryptoErrorCode;

  constructor(code: CryptoErrorCode, message: string) {
    super(message);
    this.name = "CryptoError";
    this.code = code;
  }
}

export const wrongSecret = () => new CryptoError("wrong-secret", "wrong password or recovery code");
export const corrupt = () => new CryptoError("corrupt", "vault file corrupt or tampered");
export const malformedCode = () => new CryptoError("malformed-code", "malformed recovery code");
