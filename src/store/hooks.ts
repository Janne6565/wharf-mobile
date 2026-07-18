import { useDispatch, useSelector, useStore } from "react-redux";
import type { AppDispatch, RootState, store } from "@/store";

// Typed wrappers — always use these, never the raw react-redux hooks (REACT.md).
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
// Imperative store access for reading a snapshot inside an effect/callback
// without subscribing to it (avoids re-running the effect on every state change).
export const useAppStore = useStore.withTypes<typeof store>();
