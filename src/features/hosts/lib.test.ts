import type { VaultHost } from "@/vault/document";
import { classifyProbe, DEGRADED_RTT_MS, filterHosts, groupHosts } from "./lib";

const HOSTS: readonly VaultHost[] = [
  { id: "1", name: "prod-api-01", user: "deploy", addr: "10.4.1.12", port: 22 },
  { id: "2", name: "db-primary", user: "postgres", addr: "10.4.2.5", port: 5522, tags: ["db"] },
  { id: "3", name: "homelab", user: "deniz", addr: "homelab.local", port: 22, tags: ["home"] },
];

describe("filterHosts", () => {
  it("returns everything for an empty or whitespace query", () => {
    expect(filterHosts(HOSTS, "")).toEqual(HOSTS);
    expect(filterHosts(HOSTS, "   ")).toEqual(HOSTS);
  });

  it("matches by name, case-insensitively", () => {
    expect(filterHosts(HOSTS, "PROD").map((h) => h.id)).toEqual(["1"]);
  });

  it("matches by user and address", () => {
    expect(filterHosts(HOSTS, "postgres").map((h) => h.id)).toEqual(["2"]);
    expect(filterHosts(HOSTS, "homelab.local").map((h) => h.id)).toEqual(["3"]);
  });

  it("matches the rendered user@addr:port target", () => {
    expect(filterHosts(HOSTS, "deniz@homelab").map((h) => h.id)).toEqual(["3"]);
    expect(filterHosts(HOSTS, ":5522").map((h) => h.id)).toEqual(["2"]);
  });

  it("matches by tag", () => {
    expect(filterHosts(HOSTS, "db").map((h) => h.id)).toEqual(["2"]);
  });

  it("returns empty when nothing matches", () => {
    expect(filterHosts(HOSTS, "nope")).toEqual([]);
  });
});

describe("groupHosts", () => {
  const PROJECT_HOSTS: readonly VaultHost[] = [
    { id: "p1", name: "prod-web-01", user: "deploy", addr: "10.0.4.12", port: 22 },
  ];

  it("returns a single PERSONAL section when there are no projects", () => {
    const sections = groupHosts(HOSTS, []);
    expect(sections).toHaveLength(1);
    expect(sections[0].kind).toBe("personal");
    expect(sections[0].hosts).toEqual(HOSTS);
  });

  it("orders project sections before PERSONAL (mock: ATLAS PLATFORM before PERSONAL)", () => {
    const sections = groupHosts(HOSTS, [
      { id: "atlas", name: "Atlas Platform", hosts: PROJECT_HOSTS },
    ]);
    expect(sections).toHaveLength(2);
    expect(sections[0].kind).toBe("project");
    if (sections[0].kind === "project") {
      expect(sections[0].name).toBe("Atlas Platform");
      expect(sections[0].projectId).toBe("atlas");
      expect(sections[0].hosts).toEqual(PROJECT_HOSTS);
    }
    expect(sections[1].kind).toBe("personal");
    expect(sections[1].hosts).toEqual(HOSTS);
  });
});

describe("classifyProbe", () => {
  it("classifies a failed dial (-1) as offline", () => {
    expect(classifyProbe(-1)).toBe("offline");
  });

  it("classifies a fast dial as online", () => {
    expect(classifyProbe(1)).toBe("online");
    expect(classifyProbe(42)).toBe("online");
    expect(classifyProbe(DEGRADED_RTT_MS)).toBe("online");
  });

  it("classifies a dial slower than the degraded threshold as degraded", () => {
    expect(classifyProbe(DEGRADED_RTT_MS + 1)).toBe("degraded");
    expect(classifyProbe(2500)).toBe("degraded");
  });
});
