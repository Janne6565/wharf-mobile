import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store";

// Typed wrappers — always use these, never the raw react-redux hooks (REACT.md).
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
