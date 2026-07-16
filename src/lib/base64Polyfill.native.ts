// React Native / Hermes ships no `btoa`/`atob`, but the crypto layer's
// `base64.ts` (a verbatim port of the web client's, kept byte-identical) uses
// them for the base64 <-> binary-string conversions. This installs a minimal,
// dependency-free, standards-correct implementation on `globalThis` if absent.
// Imported for side effect at the app root so it is in place before any unlock
// flow (or the crypto self-test) runs.

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// btoa: encode a binary (Latin1) string to base64.
function btoaPolyfill(input: string): string {
  let output = "";
  for (let i = 0; i < input.length; i += 3) {
    const b0 = input.charCodeAt(i);
    const b1 = i + 1 < input.length ? input.charCodeAt(i + 1) : Number.NaN;
    const b2 = i + 2 < input.length ? input.charCodeAt(i + 2) : Number.NaN;
    if (b0 > 0xff || b1 > 0xff || b2 > 0xff) {
      throw new Error("btoa: input contains characters outside the Latin1 range");
    }
    const hasB1 = !Number.isNaN(b1);
    const hasB2 = !Number.isNaN(b2);
    const triple = (b0 << 16) | ((hasB1 ? b1 : 0) << 8) | (hasB2 ? b2 : 0);
    output += B64[(triple >> 18) & 0x3f];
    output += B64[(triple >> 12) & 0x3f];
    output += hasB1 ? B64[(triple >> 6) & 0x3f] : "=";
    output += hasB2 ? B64[triple & 0x3f] : "=";
  }
  return output;
}

// atob: decode a base64 string to a binary (Latin1) string.
function atobPolyfill(input: string): string {
  const cleaned = input.replace(/[^A-Za-z0-9+/]/g, "");
  let output = "";
  for (let i = 0; i < cleaned.length; i += 4) {
    const c0 = B64.indexOf(cleaned[i]);
    const c1 = B64.indexOf(cleaned[i + 1]);
    const c2 = i + 2 < cleaned.length ? B64.indexOf(cleaned[i + 2]) : -1;
    const c3 = i + 3 < cleaned.length ? B64.indexOf(cleaned[i + 3]) : -1;
    const triple = (c0 << 18) | (c1 << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f);
    output += String.fromCharCode((triple >> 16) & 0xff);
    if (c2 !== -1) {
      output += String.fromCharCode((triple >> 8) & 0xff);
    }
    if (c3 !== -1) {
      output += String.fromCharCode(triple & 0xff);
    }
  }
  return output;
}

const scope = globalThis as unknown as {
  btoa?: (input: string) => string;
  atob?: (input: string) => string;
};

if (typeof scope.btoa !== "function") {
  scope.btoa = btoaPolyfill;
}
if (typeof scope.atob !== "function") {
  scope.atob = atobPolyfill;
}

export {};
