// Connectivity signal for the sync engine, over expo-network.
//
// Why expo-network (not @react-native-community/netinfo): the engine needs only
// a coarse "are we online?" edge to (a) show an offline banner and (b) fire a
// sync when connectivity returns. expo-network is a first-party Expo module —
// already the family every other native dependency here comes from (expo-secure-
// store, expo-file-system, expo-local-authentication) — so it autolinks with no
// extra config, is versioned in lockstep with the SDK, and adds no third-party
// maintenance surface. netinfo's richer reachability/connection-type detail buys
// nothing for a binary offline flag. On iOS `isInternetReachable` mirrors
// `isConnected`; on Android it additionally confirms validated internet, which is
// exactly the "can I actually reach the backend" signal we want.

import * as Network from "expo-network";

export type ConnectivityListener = (online: boolean) => void;

function isReachable(state: Network.NetworkState): boolean {
  // Treat "unknown reachability" (undefined) as online: a false negative would
  // wrongly suppress syncs, whereas an over-eager sync just fails and retries.
  return Boolean(state.isConnected) && state.isInternetReachable !== false;
}

// Subscribe to connectivity edges. The callback fires with the current online
// state on every change. Returns an unsubscribe function.
export function subscribeConnectivity(listener: ConnectivityListener): () => void {
  const subscription = Network.addNetworkStateListener((state) => {
    listener(isReachable(state));
  });
  return () => subscription.remove();
}

// One-shot connectivity check. Defaults to online when the state cannot be read
// (see isReachable: a false negative is worse than an over-eager sync).
export async function isOnline(): Promise<boolean> {
  try {
    return isReachable(await Network.getNetworkStateAsync());
  } catch {
    return true;
  }
}
