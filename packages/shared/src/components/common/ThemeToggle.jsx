import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getStoredTheme, toggleTheme } from "@/utils/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState(() => getStoredTheme());

  const handleToggleTheme = () => {
    setTheme(toggleTheme());
  };

  const isDark = theme === "dark";

  return (
    <Button
      variant="secondary"
      className="gap-2"
      title={isDark ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
      onClick={handleToggleTheme}
    >
      {isDark ? <Sun className="size-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden /> : <Moon className="size-4 shrink-0 text-slate-700" aria-hidden />}
      <span>{isDark ? "Chế độ sáng" : "Chế độ tối"}</span>
    </Button>
  );
}
