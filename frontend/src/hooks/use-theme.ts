import { useCallback, useSyncExternalStore } from "react";

import { getTheme, setTheme, subscribeTheme, type Theme } from "@/lib/theme";

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const theme = useSyncExternalStore(subscribeTheme, getTheme);
  const toggleTheme = useCallback(() => setTheme(getTheme() === "dark" ? "light" : "dark"), []);
  return { theme, toggleTheme };
}
