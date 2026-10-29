import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="grid size-8 place-items-center rounded-lg text-muted ring-1 ring-line transition-colors hover:bg-sunken hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
