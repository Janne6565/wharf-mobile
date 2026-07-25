// The Problem Details reader: feature hooks branch on the machine-readable
// `code` property, so it has to survive the shapes a real rejection can take —
// and stay silent for anything that is not one.

import { AxiosError, AxiosHeaders } from "axios";
import { EMAIL_NOT_VERIFIED_CODE, getHttpStatus, getProblemCode } from "./httpError";

function rejection(status: number, data: unknown): AxiosError {
  return new AxiosError("rejected", "ERR_BAD_RESPONSE", undefined, undefined, {
    status,
    statusText: "",
    data,
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  });
}

describe("getProblemCode", () => {
  it("reads the code out of a Problem Details body", () => {
    const error = rejection(403, {
      type: "about:blank",
      title: "Forbidden",
      detail: "Verify your email address before signing in.",
      code: EMAIL_NOT_VERIFIED_CODE,
    });

    expect(getProblemCode(error)).toBe("email_not_verified");
    expect(getHttpStatus(error)).toBe(403);
  });

  it("returns undefined when the body carries no code", () => {
    expect(getProblemCode(rejection(403, { detail: "Forbidden" }))).toBeUndefined();
  });

  it("ignores a non-string code and a non-object body", () => {
    expect(getProblemCode(rejection(400, { code: 42 }))).toBeUndefined();
    expect(getProblemCode(rejection(502, "Bad Gateway"))).toBeUndefined();
    expect(getProblemCode(rejection(500, null))).toBeUndefined();
  });

  it("returns undefined for a network failure and for a plain Error", () => {
    expect(getProblemCode(new AxiosError("Network Error"))).toBeUndefined();
    expect(getProblemCode(new Error("boom"))).toBeUndefined();
  });
});
