"use client";

import { useEffect } from "react";
import { startNavigationIntent } from "@/components/navigation/navigationIntentStore";

function shouldIgnoreClick(e) {
  if (e.defaultPrevented || e.button !== 0) {
    return true;
  }
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
    return true;
  }
  return false;
}

/**
 * Bắt mọi click vào `<a href>` cùng origin (gồm Next `<Link>`) ở capture phase
 * để bật intent trước khi React/Next xử lý navigation (tránh UI đứng im).
 */
export function NavigationIntentClickCapture() {
  useEffect(() => {
    const onPointerDownCapture = (e) => {
      if (shouldIgnoreClick(e)) {
        return;
      }
      const target = e.target;
      if (!(target instanceof Element)) {
        return;
      }
      const anchor = target.closest("a[href]");
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) {
        return;
      }
      if (anchor.getAttribute("download") != null) {
        return;
      }
      if (anchor.target === "_blank") {
        return;
      }
      const raw = anchor.getAttribute("href");
      if (raw == null || raw === "" || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) {
        return;
      }
      let url;
      try {
        url = new URL(raw, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) {
        return;
      }
      const same =
        url.pathname === window.location.pathname && url.search === window.location.search;
      if (same) {
        return;
      }
      startNavigationIntent();
    };

    document.addEventListener("pointerdown", onPointerDownCapture, true);
    return () => document.removeEventListener("pointerdown", onPointerDownCapture, true);
  }, []);

  return null;
}
