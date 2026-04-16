import { useEffect, useState } from "react";
import { initializeTheme, toggleTheme } from "../templates/theme";

export const ThemeToggle = () => {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    setTheme(initializeTheme());
  }, []);

  return (
    <button
      type="button"
      className="rounded-[var(--radius)] border bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--card-foreground))] shadow-[var(--shadow-sm)]"
      onClick={() => setTheme(toggleTheme())}
    >
      Theme: {theme}
    </button>
  );
};
