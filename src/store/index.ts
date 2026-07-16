import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/authSlice";
import projectsReducer from "@/store/projectsSlice";
import settingsReducer from "@/store/settingsSlice";
import syncReducer from "@/store/syncSlice";
import toastReducer from "@/store/toastSlice";
import vaultReducer from "@/store/vaultSlice";

// Redux Toolkit owns client/UI state (settings, derived auth session, derived
// vault state). Server interactions go through TanStack Query, not here; key
// material stays in module memory, never in the store (see REACT.md, vaultSlice).
export const store = configureStore({
  reducer: {
    settings: settingsReducer,
    auth: authReducer,
    vault: vaultReducer,
    sync: syncReducer,
    projects: projectsReducer,
    toast: toastReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
