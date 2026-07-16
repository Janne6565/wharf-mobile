import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "@/api/wharf";
import { useAppSelector } from "@/store/hooks";

// The sign-in method we can derive from the profile flags. The backend does not
// expose which OAuth provider linked the account, so "oauth" is as specific as we
// can be; "password" covers an email-and-password account. Null while loading.
export type SignInMethod = "password" | "oauth" | null;

// Reads the account's profile for the Settings account section. The email falls
// back to the derived-session value in the store so the row is populated
// immediately, then refines to the fetched profile. `method` powers the
// "Signed in via" row and is omitted when it cannot be derived.
export function useAccountInfo() {
  const sessionEmail = useAppSelector((state) => state.auth.user?.email);
  const profileQuery = useQuery({
    queryKey: ["users", "me"],
    queryFn: () => getCurrentUser(),
  });

  const email = profileQuery.data?.email ?? sessionEmail ?? "";
  const hasPassword = profileQuery.data?.hasPassword;
  const method: SignInMethod =
    hasPassword === undefined ? null : hasPassword ? "password" : "oauth";

  return { email, method };
}
