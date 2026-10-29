/**
 * Light/dark theme as a tiny external store. The theme lives on
 * `<html data-theme>` (set before first paint by the inline script in
 * index.html) so CSS tokens and the `dark:` variant switch without a re-render
 * cascade; React subscribes only where it needs the value (toggle, basemap).
 */
export type Theme = "dark" | "light";

const STORAGE_KEY = "theme";
const listeners = new Set<() => void>();

function readStoredTheme(): Theme | undefined {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "dark" || value === "light" ? value : undefined;
  } catch {
    // storage can be blocked (private mode, sandboxed iframes)
    return undefined;
  }
}

/** Stored choice first, then the OS preference; dark when neither says otherwise. */
export function getInitialTheme(): Theme {
  const stored = readStoredTheme();
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function getTheme(): Theme {
  const value = document.documentElement.dataset.theme;
  return value === "light" || value === "dark" ? value : getInitialTheme();
}

export function setTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // not persisting is fine; the toggle still works for this session
  }
  listeners.forEach((listener) => listener());
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
