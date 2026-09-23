import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useClientPersist } from "@/lib/clientPersist/ClientPersistenceProvider.jsx";
import { applyDomFields, collectDomFields } from "@/lib/clientPersist/domFields.js";
import {
  buildRouteHref,
  getLastRoute,
  setLastRoute,
  shouldRestoreLastRoute,
} from "@/lib/clientPersist/lastRoute.js";
import { getPageUi, setPageUi } from "@/lib/clientPersist/pageUi.js";
import {
  applyScrollMap,
  collectScrollMap,
  normalizeScrollMap,
  scrollKeyFor,
} from "@/lib/clientPersist/scrollMap.js";

const SCROLL_ROOT_SELECTOR = '[data-page-scroll-owner="true"]';
const SCHEMA_VERSION = 3;
const DEBOUNCE_MS = 250;
const RESTORE_RETRY_MS = [0, 80, 250, 600];

function scrollRoot() {
  return typeof document !== "undefined" ? document.querySelector(SCROLL_ROOT_SELECTOR) : null;
}

/**
 * Persist DOM fields + nested scrolls on every private route; soft-landing last route.
 *
 * Critical: on route change, flush the *previous* routeKey using live field/scroll
 * snapshots — do not re-query the DOM (children already unmounted) and do not use
 * the new routeKey from ctxRef (render already advanced).
 */
export function usePrivateDomUiPersist() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : "";
  const routeKey = buildRouteHref(pathname, search);
  const { userId, ready: persistReady } = useClientPersist();

  const debounceRef = useRef(null);
  const routeRestoreTriedRef = useRef(false);
  const fieldsTouchedRef = useRef(false);
  const scrollTouchedRef = useRef(false);
  const scrollLiveRef = useRef(/** @type {Record<string, number>} */ ({}));
  const fieldsLiveRef = useRef(/** @type {Record<string, string | boolean>} */ ({}));

  const flushRoute = useCallback(async (uid, key, fields, scroll) => {
    if (uid == null || !key) {
      return;
    }
    try {
      await setPageUi({
        userId: uid,
        routeKey: key,
        schemaVersion: SCHEMA_VERSION,
        scroll,
        fields,
        savedAt: new Date().toISOString(),
      });
      await setLastRoute(uid, key);
    } catch {
      /* fail-soft */
    }
  }, []);

  const captureLiveFromDom = useCallback(() => {
    const root = scrollRoot();
    if (!root) {
      return;
    }
    fieldsLiveRef.current = collectDomFields(root);
    const scanned = collectScrollMap(root);
    scrollLiveRef.current = { ...scanned, ...scrollLiveRef.current };
  }, []);

  const scheduleFlush = useCallback(
    (uid, key) => {
      if (debounceRef.current != null) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        captureLiveFromDom();
        void flushRoute(uid, key, { ...fieldsLiveRef.current }, { ...scrollLiveRef.current });
      }, DEBOUNCE_MS);
    },
    [captureLiveFromDom, flushRoute],
  );

  // Soft-landing → last private route (once).
  useEffect(() => {
    if (!persistReady || userId == null || routeRestoreTriedRef.current) {
      return;
    }
    routeRestoreTriedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const last = await getLastRoute(userId);
        if (cancelled || !shouldRestoreLastRoute(pathname, last)) {
          return;
        }
        router.replace(last);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persistReady, userId, pathname, router]);

  // Hydrate once per route; stop after user interacts (avoids fighting clicks / scroll).
  useEffect(() => {
    if (!persistReady || userId == null || !routeKey) {
      return undefined;
    }
    let cancelled = false;
    const timers = [];
    fieldsTouchedRef.current = false;
    scrollTouchedRef.current = false;
    scrollLiveRef.current = {};
    fieldsLiveRef.current = {};

    (async () => {
      let record = null;
      try {
        record = await getPageUi({ userId, routeKey });
      } catch {
        return;
      }
      if (cancelled || !record) {
        return;
      }
      const ver = record.schemaVersion;
      if (ver !== SCHEMA_VERSION && ver !== 2 && ver !== 1) {
        return;
      }

      const scrollMap = normalizeScrollMap(record.scroll);
      scrollLiveRef.current = { ...scrollMap };
      if (record.fields && typeof record.fields === "object") {
        fieldsLiveRef.current = { ...record.fields };
      }

      const applyOnce = () => {
        if (cancelled) {
          return;
        }
        const root = scrollRoot();
        if (!root) {
          return;
        }
        if (record.fields && !fieldsTouchedRef.current) {
          applyDomFields(root, record.fields);
        }
        if (!scrollTouchedRef.current) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (cancelled || scrollTouchedRef.current) {
                return;
              }
              applyScrollMap(root, scrollLiveRef.current);
            });
          });
        }
      };

      for (const ms of RESTORE_RETRY_MS) {
        timers.push(window.setTimeout(applyOnce, ms));
      }
    })();

    return () => {
      cancelled = true;
      for (const t of timers) {
        clearTimeout(t);
      }
    };
  }, [persistReady, userId, routeKey]);

  // Capture fields + nested scrolls; flush bound to THIS routeKey on leave.
  useEffect(() => {
    if (!persistReady || userId == null || !routeKey) {
      return undefined;
    }
    const boundRoute = routeKey;
    const boundUserId = userId;
    const root = scrollRoot();
    if (!root) {
      return undefined;
    }

    const scrollIntentRef = { current: false };
    const markScrollIntent = () => {
      scrollIntentRef.current = true;
    };

    const onField = (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) {
        return;
      }
      if (t.closest?.("[data-no-persist-root='true']")) {
        return;
      }
      if (t.matches?.("input, textarea, select")) {
        fieldsTouchedRef.current = true;
        captureLiveFromDom();
        scheduleFlush(boundUserId, boundRoute);
      }
    };

    const onScroll = (e) => {
      const t = e.target;
      if (!(t instanceof Element) || !root.contains(t)) {
        return;
      }
      const key = scrollKeyFor(root, t);
      if (!key) {
        return;
      }
      const prev = scrollLiveRef.current[key] ?? 0;
      const next = t.scrollTop;
      if (next < 8 && prev > 40 && !scrollIntentRef.current) {
        return;
      }
      scrollIntentRef.current = false;
      scrollTouchedRef.current = true;
      scrollLiveRef.current[key] = next;
      scheduleFlush(boundUserId, boundRoute);
    };

    const reapplyScrollAfterTab = (e) => {
      const t = e.target;
      if (!(t instanceof Element) || !t.closest?.('[role="tab"]')) {
        return;
      }
      const map = { ...scrollLiveRef.current };
      window.setTimeout(() => applyScrollMap(root, map), 80);
      window.setTimeout(() => applyScrollMap(root, map), 280);
    };

    const flushBound = () => {
      if (debounceRef.current != null) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      // Use live snapshots — DOM children for this route may already be gone.
      void flushRoute(boundUserId, boundRoute, { ...fieldsLiveRef.current }, {
        ...scrollLiveRef.current,
      });
    };

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        flushBound();
      }
    };

    root.addEventListener("wheel", markScrollIntent, { capture: true, passive: true });
    root.addEventListener("touchmove", markScrollIntent, { capture: true, passive: true });
    root.addEventListener("pointerdown", reapplyScrollAfterTab, true);
    root.addEventListener("input", onField, true);
    root.addEventListener("change", onField, true);
    root.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("pagehide", flushBound);
    document.addEventListener("visibilitychange", onVis);

    void setLastRoute(boundUserId, boundRoute).catch(() => {});

    return () => {
      root.removeEventListener("wheel", markScrollIntent, true);
      root.removeEventListener("touchmove", markScrollIntent, true);
      root.removeEventListener("pointerdown", reapplyScrollAfterTab, true);
      root.removeEventListener("input", onField, true);
      root.removeEventListener("change", onField, true);
      root.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("pagehide", flushBound);
      document.removeEventListener("visibilitychange", onVis);
      flushBound();
    };
  }, [persistReady, userId, routeKey, scheduleFlush, flushRoute, captureLiveFromDom]);

  useEffect(
    () => () => {
      if (debounceRef.current != null) {
        clearTimeout(debounceRef.current);
      }
    },
    [],
  );
}
