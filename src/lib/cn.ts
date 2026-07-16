import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Merge conditional Tailwind class names, resolving conflicts (later wins). Used
// with NativeWind's className prop exactly as on the web.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
