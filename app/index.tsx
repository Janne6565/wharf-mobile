import { Redirect } from "expo-router";

// The app opens on the Hosts tab (auth/unlock gating lands in M2).
export default function Index() {
  return <Redirect href="/hosts" />;
}
