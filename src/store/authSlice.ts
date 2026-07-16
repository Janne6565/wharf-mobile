import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// Auth UI state. The raw access token lives in `src/auth/tokenStore` (in memory)
// and the refresh token in SecureStore; this slice mirrors only the *derived*
// session for the UI — who is signed in and whether the initial silent-refresh
// bootstrap has resolved yet. It holds no secrets. Mirrors wharf-web's authSlice.

export interface AuthUser {
  readonly id: string;
  readonly email: string;
}

// "unknown" until the app-start bootstrap resolves; the router shows a loader
// while unknown so a signed-in user is never flashed the sign-in screen.
export type AuthStatus = "unknown" | "authenticated" | "anonymous";

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
}

const initialState: AuthState = {
  status: "unknown",
  user: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    sessionEstablished(state, action: PayloadAction<AuthUser>) {
      state.status = "authenticated";
      state.user = action.payload;
    },
    sessionResolvedAnonymous(state) {
      state.status = "anonymous";
      state.user = null;
    },
    sessionCleared(state) {
      state.status = "anonymous";
      state.user = null;
    },
  },
});

export const { sessionEstablished, sessionResolvedAnonymous, sessionCleared } = authSlice.actions;
export default authSlice.reducer;
