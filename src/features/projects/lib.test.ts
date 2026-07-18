import { avatarInitials, projectInitials, ROLE_LABEL_KEY } from "./lib";

describe("avatarInitials", () => {
  it("takes the first letters of a dotted email local-part", () => {
    expect(avatarInitials("mara.novak@acme.io")).toBe("MN");
  });

  it("falls back to the first two characters of a single-token local-part", () => {
    expect(avatarInitials("deniz@acme.io")).toBe("DE");
  });

  it("handles a bare name and separators", () => {
    expect(avatarInitials("jonas")).toBe("JO");
    expect(avatarInitials("sam-lee")).toBe("SL");
  });

  it("returns a placeholder for empty input", () => {
    expect(avatarInitials("   ")).toBe("?");
  });
});

describe("projectInitials", () => {
  it("takes the first letter of the first two words", () => {
    expect(projectInitials("Atlas Platform")).toBe("AP");
    expect(projectInitials("Beacon Ops Prod")).toBe("BO");
  });

  it("uses the first two characters of a single-word name", () => {
    expect(projectInitials("Nebula")).toBe("NE");
  });

  it("collapses extra whitespace between words", () => {
    expect(projectInitials("  Homelab   Shared ")).toBe("HS");
  });

  it("returns a placeholder for empty input", () => {
    expect(projectInitials("   ")).toBe("?");
  });
});

describe("ROLE_LABEL_KEY", () => {
  it("maps every role to its translation key", () => {
    expect(ROLE_LABEL_KEY.OWNER).toBe("projects.roleOwner");
    expect(ROLE_LABEL_KEY.ADMIN).toBe("projects.roleAdmin");
    expect(ROLE_LABEL_KEY.MEMBER).toBe("projects.roleMember");
  });
});
