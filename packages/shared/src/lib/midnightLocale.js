/** Landing locale. Cookie is the SSR source of truth; localStorage mirrors it. */

export const MIDNIGHT_LOCALES = ["vi", "en"];
export const MIDNIGHT_LOCALE_COOKIE = "midnight_lang";
export const MIDNIGHT_LOCALE_STORAGE_KEY = "midnight_lang";
export const MIDNIGHT_LOCALE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

/** @param {unknown} value */
export function normalizeMidnightLocale(value) {
  return value === "en" ? "en" : "vi";
}

export function readMidnightLocaleCookie() {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${MIDNIGHT_LOCALE_COOKIE}=([^;]*)`));
  if (!match) return null;
  try {
    return normalizeMidnightLocale(decodeURIComponent(match[1]));
  } catch {
    return "vi";
  }
}

/** @param {unknown} locale */
export function writeMidnightLocaleCookie(locale) {
  if (typeof document === "undefined") return;
  const value = normalizeMidnightLocale(locale);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${MIDNIGHT_LOCALE_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${MIDNIGHT_LOCALE_MAX_AGE_SEC}; SameSite=Lax${secure}`;
}

/** Sets `<html lang>` before paint on the public home page only. Other routes stay `vi`. */
export const MIDNIGHT_LANG_INIT_SCRIPT = `(function(){try{var p=location.pathname;if(p!=="/"&&p!=="")return;var m=document.cookie.match(/(?:^|; )${MIDNIGHT_LOCALE_COOKIE}=([^;]*)/);if(m&&decodeURIComponent(m[1])==="en")document.documentElement.lang="en";}catch(e){}})();`;
