// Pure helpers for the projects feature: role → i18n key, avatar initials, and
// the admin-gate predicate. Framework-free so they unit-test without React
// (REACT.md lib.ts convention).

import type { ProjectRole } from "@/api/generated/model";

// The i18n key for a role's display label. `as const` keeps the values as literal
// keys so t() (which requires a known key) accepts ROLE_LABEL_KEY[role] directly.
export const ROLE_LABEL_KEY = {
  OWNER: "projects.roleOwner",
  ADMIN: "projects.roleAdmin",
  MEMBER: "projects.roleMember",
} as const;

// Whether a role may administer a project: create/revoke invites and run the
// finalize pass. Owner and admin qualify; a plain member (or an unknown role)
// does not, so the invite/revoke affordances stay hidden for members.
export function canAdminister(role: ProjectRole | undefined): boolean {
  return role === "ADMIN" || role === "OWNER";
}

// Two-letter uppercase initials for an avatar, derived from an email or name.
// Splits the email local-part on common separators; falls back to its first two
// characters. Non-alphanumeric-only input yields "?".
export function avatarInitials(text: string): string {
  const cleaned = text.trim();
  if (!cleaned) {
    return "?";
  }
  const local = cleaned.split("@")[0];
  const parts = local.split(/[.\-_ ]+/).filter((p) => p.length > 0);
  const letters =
    parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`
      : local.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2);
  return (letters || "?").toUpperCase();
}
