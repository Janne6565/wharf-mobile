import { QueryClient } from "@tanstack/react-query";

// Single QueryClient for the app, provided at the root inside the Redux Provider.
// Sane mobile defaults; no persistence yet (offline cache lands with the sync
// engine in M3).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});
