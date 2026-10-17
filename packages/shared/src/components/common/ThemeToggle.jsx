"use client";

import { useEffect, useRef, useState } from "react";
import { Check, MoonStar, Palette, Sun } from "lucide-react";
import { cn } from "@/utils/cn";
import {
  ACCENTS,
  applyAccent,
  applyHighContrast,
  applyTheme,
  getStoredAccent,
  getStoredHighContrast,
  getStoredTheme,
} from "@/utils/theme";

function ThemePanel() {
  // Defaults on first render (SSR-safe), then read storage after mount.
  const [theme, setTheme] = useState("light");
  const [accent, setAccent] = useState(ACCENTS[0].id);
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    setTheme(getStoredTheme());
    setAccent(getStoredAccent());
    setHighContrast(getStoredHighContrast());
  }, []);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-border p-1" role="radiogroup" aria-label="Chế độ">
        {[
          { id: "light", label: "Sáng", Icon: Sun },
          { id: "dark", label: "Tối", Icon: MoonStar },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={theme === id}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition",
              theme === id ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
            )}
            onClick={() => {
              applyTheme(id);
              setTheme(id);
            }}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Màu chủ đạo">
        {ACCENTS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={accent === item.id}
            aria-label={item.label}
            title={item.label}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-full border-2 text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              accent === item.id ? "border-foreground" : "border-transparent",
            )}
            style={{ backgroundColor: item.swatch }}
            onClick={() => setAccent(applyAccent(item.id))}
          >
            {accent === item.id ? <Check className="size-4" aria-hidden /> : null}
          </button>
        ))}
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          className="size-4 accent-[hsl(var(--primary))]"
          checked={highContrast}
          onChange={(event) => setHighContrast(applyHighContrast(event.target.checked))}
        />
        Tương phản cao
      </label>
    </div>
  );
}

/**
 * Single theme picker (light/dark, accent, high contrast), persisted in localStorage.
 * `variant="inline"` renders the panel directly; `variant="popover"` renders an icon trigger.
 */
export function ThemePicker({ variant = "inline", className }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (variant !== "popover") {
    return (
      <div className={className}>
        <ThemePanel />
      </div>
    );
  }

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm transition hover:bg-secondary"
        title="Giao diện"
        aria-label="Giao diện"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Palette className="size-4" aria-hidden />
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-border bg-card p-3 shadow-float">
          <ThemePanel />
        </div>
      ) : null}
    </div>
  );
}
