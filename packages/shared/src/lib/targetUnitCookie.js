import {
  TARGET_UNIT_COOKIE_MAX_AGE_SEC,
  TARGET_UNIT_COOKIE_NAME,
} from "@/constants/targetUnitCookie";

function secureCookieFlag() {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.protocol === "https:" ? "; Secure" : "";
}

/** @param {number | string | null | undefined} id */
export function setTargetUnitIdCookieClient(id) {
  if (typeof document === "undefined") {
    return;
  }
  if (id == null || id === "") {
    clearTargetUnitIdCookieClient();
    return;
  }
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) {
    clearTargetUnitIdCookieClient();
    return;
  }
  document.cookie = `${TARGET_UNIT_COOKIE_NAME}=${encodeURIComponent(String(n))}; Path=/; Max-Age=${TARGET_UNIT_COOKIE_MAX_AGE_SEC}; SameSite=Lax${secureCookieFlag()}`;
}

export function clearTargetUnitIdCookieClient() {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${TARGET_UNIT_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secureCookieFlag()}`;
}
