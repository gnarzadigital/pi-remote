import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Theme } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function hapticTap() {
  if (navigator.vibrate) navigator.vibrate(10);
}

/**
 * Apply a named theme to the document root. Console is a warm-dark theme, so it
 * gets `.dark` (so `dark:` utility variants still apply) plus `.theme-console`
 * which overrides the color tokens with the Calm Console parchment palette.
 */
export function applyTheme(theme: Theme) {
  const el = document.documentElement;
  el.classList.toggle("dark", theme === "dark" || theme === "console");
  el.classList.toggle("theme-console", theme === "console");
}
