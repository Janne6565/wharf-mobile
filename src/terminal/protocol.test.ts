import { parseOutbound, serializeInbound, type TerminalInbound } from "./protocol";

describe("parseOutbound", () => {
  it("decodes a ready message", () => {
    expect(parseOutbound(JSON.stringify({ type: "ready" }))).toEqual({ type: "ready" });
  });

  it("decodes a data message with its base64 payload", () => {
    expect(parseOutbound(JSON.stringify({ type: "data", dataB64: "bHM=" }))).toEqual({
      type: "data",
      dataB64: "bHM=",
    });
  });

  it("decodes a size message", () => {
    expect(parseOutbound(JSON.stringify({ type: "size", cols: 80, rows: 24 }))).toEqual({
      type: "size",
      cols: 80,
      rows: 24,
    });
  });

  it("returns null for malformed JSON", () => {
    expect(parseOutbound("{not json")).toBeNull();
  });

  it("returns null for an unknown type", () => {
    expect(parseOutbound(JSON.stringify({ type: "nope" }))).toBeNull();
  });

  it("returns null when required fields are missing or mistyped", () => {
    expect(parseOutbound(JSON.stringify({ type: "data" }))).toBeNull();
    expect(parseOutbound(JSON.stringify({ type: "size", cols: "80", rows: 24 }))).toBeNull();
  });

  it("returns null for a non-object payload", () => {
    expect(parseOutbound(JSON.stringify(42))).toBeNull();
    expect(parseOutbound(JSON.stringify(null))).toBeNull();
  });
});

describe("serializeInbound", () => {
  it("round-trips a write message", () => {
    const msg: TerminalInbound = { type: "write", dataB64: "aGk=" };
    expect(JSON.parse(serializeInbound(msg))).toEqual(msg);
  });

  it("round-trips a theme message", () => {
    const msg: TerminalInbound = { type: "theme", accent: "#57D7C2" };
    expect(JSON.parse(serializeInbound(msg))).toEqual(msg);
  });
});
