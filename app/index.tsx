import { Redirect } from "expo-router";
import { useAppSelector } from "@/store/hooks";

// The anchor route: expo-router lands here whenever a Protected group's guard
// flips a screen away. It only re-routes by the derived auth/vault state — the
// guards in app/_layout.tsx are what actually gate access.
export default function Index() {
  const authStatus = useAppSelector((state) => state.auth.status);
  const vaultStatus = useAppSelector((state) => state.vault.status);

  if (authStatus !== "authenticated") {
    return <Redirect href="/sign-in" />;
  }
  if (vaultStatus !== "unlocked") {
    return <Redirect href="/unlock" />;
  }
  return <Redirect href="/hosts" />;
}
