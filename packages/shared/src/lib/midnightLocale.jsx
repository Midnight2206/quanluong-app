"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getMidnightCopy, midnightLandingMeta } from "@/lib/midnightLandingCopy";
import {
  MIDNIGHT_LOCALE_STORAGE_KEY,
  normalizeMidnightLocale,
  readMidnightLocaleCookie,
  writeMidnightLocaleCookie,
} from "@/lib/midnightLocale";

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
