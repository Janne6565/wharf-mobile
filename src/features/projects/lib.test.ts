import { avatarInitials, ROLE_LABEL_KEY } from "./lib";

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

describe("ROLE_LABEL_KEY", () => {
  it("maps every role to its translation key", () => {
    expect(ROLE_LABEL_KEY.OWNER).toBe("projects.roleOwner");
    expect(ROLE_LABEL_KEY.ADMIN).toBe("projects.roleAdmin");
    expect(ROLE_LABEL_KEY.MEMBER).toBe("projects.roleMember");
  });
});
