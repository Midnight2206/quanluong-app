"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getMidnightCopy, midnightLandingMeta } from "@/lib/midnightLandingCopy";
import {
  MIDNIGHT_LOCALES,
  MIDNIGHT_LOCALE_STORAGE_KEY,
  normalizeMidnightLocale,
  readMidnightLocaleCookie,
  writeMidnightLocaleCookie,
} from "@/lib/midnightLocale";
import { cn } from "@/utils/cn";

const MidnightLocaleContext = createContext(null);

/** @param {string} locale */
export function applyMidnightDocumentLocale(locale) {
  if (typeof document === "undefined") return;
  const lang = normalizeMidnightLocale(locale);
  const meta = midnightLandingMeta(lang);
  document.documentElement.lang = lang;
  const set = (selector, value) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute("content", value);
  };
  set('meta[name="description"]', meta.description);
  set('meta[property="og:description"]', meta.description);
  set('meta[property="og:locale"]', meta.ogLocale);
  set('meta[name="twitter:description"]', meta.description);
  document.title = meta.documentTitle;
}

export function MidnightLocaleProvider({ initialLocale = "vi", children }) {
  const [locale, setLocaleState] = useState(() => normalizeMidnightLocale(initialLocale));
  const copy = useMemo(() => getMidnightCopy(locale), [locale]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MIDNIGHT_LOCALE_STORAGE_KEY);
      const cookie = readMidnightLocaleCookie();
      if (!cookie && raw) {
        const stored = normalizeMidnightLocale(raw);
        if (stored !== locale) {
          writeMidnightLocaleCookie(stored);
          setLocaleState(stored);
          return undefined;
        }
      }
      localStorage.setItem(MIDNIGHT_LOCALE_STORAGE_KEY, locale);
    } catch {
      // Private mode: the cookie still carries the choice.
    }
    applyMidnightDocumentLocale(locale);
    return () => {
      document.documentElement.lang = "vi";
    };
  }, [locale]);

  const setLocale = useCallback((next) => {
    const value = normalizeMidnightLocale(next);
    writeMidnightLocaleCookie(value);
    try {
      localStorage.setItem(MIDNIGHT_LOCALE_STORAGE_KEY, value);
    } catch {
      // Cookie already written.
    }
    applyMidnightDocumentLocale(value);
    setLocaleState(value);
  }, []);

  const value = useMemo(() => ({ locale, setLocale, copy }), [locale, setLocale, copy]);
  return <MidnightLocaleContext.Provider value={value}>{children}</MidnightLocaleContext.Provider>;
}

export function useMidnightLocale() {
  const ctx = useContext(MidnightLocaleContext);
  if (!ctx) {
    throw new Error("useMidnightLocale must be used inside MidnightLocaleProvider");
  }
  return ctx;
}

/**
 * One grid cell holds every locale's string, so the box is the widest and tallest.
 * Inactive strings stay in layout (`visibility: hidden`) and out of the accessibility tree.
 * A new entry in `MIDNIGHT_LOCALES` grows the box. Text wraps; it is never clipped.
 *
 * `block` fills the parent width (paragraphs, tile copy). Inline sizes to the longest label (buttons).
 *
 * @param {{ pick: (copy: ReturnType<typeof getMidnightCopy>) => string, block?: boolean, className?: string }} props
 */
export function LocaleText({ pick, block = false, className }) {
  const { locale } = useMidnightLocale();
  return (
    <span
      className={cn(block ? "grid w-full" : "inline-grid max-w-full", className)}
      style={block ? undefined : { gridTemplateColumns: "minmax(0, max-content)" }}
    >
      {MIDNIGHT_LOCALES.map((loc) => {
        const active = loc === locale;
        return (
          <span
            key={loc}
            className={cn(
              "col-start-1 row-start-1 break-words",
              block ? "w-full" : "text-center",
              !active && "invisible",
            )}
            aria-hidden={active ? undefined : true}
          >
            {pick(getMidnightCopy(loc))}
          </span>
        );
      })}
    </span>
  );
}
