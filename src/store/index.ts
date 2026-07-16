import { configureStore } from "@reduxjs/toolkit";
import settingsReducer from "@/store/settingsSlice";

// Redux Toolkit owns client/UI state (settings now; session/vault land in M2+).
// Server interactions go through TanStack Query, not here (see REACT.md).
export const store = configureStore({
  reducer: {
    settings: settingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
