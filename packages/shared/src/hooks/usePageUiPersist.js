import { useCallback, useEffect, useRef, useState } from "react";
import { useClientPersist } from "@/lib/clientPersist/ClientPersistenceProvider.jsx";
import {
  notifyPageUiStaleFromOtherTab,
  postPageUiBroadcast,
  subscribePageUiBroadcast,
} from "@/lib/clientPersist/broadcast.js";
import { getPageUi, setPageUi } from "@/lib/clientPersist/pageUi.js";
import { pageUiKey } from "@/lib/clientPersist/keys.js";

const DEFAULT_SCROLL_SELECTOR = '[data-page-scroll-owner="true"]';
const DEBOUNCE_MS = 200;

function restoreScrollTop(scrollSelector, scrollTop) {
  if (typeof scrollTop !== "number" || !Number.isFinite(scrollTop)) {
    return;
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = document.querySelector(scrollSelector);
      if (el) {
        el.scrollTop = scrollTop;
      }
    });
  });
}

function subsetFields(fields, fieldKeys) {
  if (!fields || !fieldKeys.length) {
    return null;
  }
  const out = {};
  for (const key of fieldKeys) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      out[key] = fields[key];
    }
  }
  return out;
}

/**
 * @param {{
 *   routeKey: string,
 *   schemaVersion: number,
 *   unitScope?: number | null,
 *   fieldKeys: string[],
 *   getFields: () => object,
 *   setFields: (fields: object) => void,
 *   scrollSelector?: string,
 *   enabled?: boolean,
 * }} opts
 */
export function usePageUiPersist({
  routeKey,
  schemaVersion,
  unitScope,
  fieldKeys,
  getFields,
  setFields,
  scrollSelector = DEFAULT_SCROLL_SELECTOR,
  enabled = true,
}) {
  const { userId, ready: persistReady } = useClientPersist();
  const [hydrated, setHydrated] = useState(false);
  const debounceRef = useRef(null);
  const lastSavedAtRef = useRef(null);
  const lastFieldsJsonRef = useRef(null);
  const ctxRef = useRef({
    enabled,
    userId,
    routeKey,
    schemaVersion,
    unitScope,
    fieldKeys,
    scrollSelector,
  });
  ctxRef.current = {
    enabled,
    userId,
    routeKey,
    schemaVersion,
    unitScope,
    fieldKeys,
    scrollSelector,
  };
  const getFieldsRef = useRef(getFields);
  getFieldsRef.current = getFields;
  const setFieldsRef = useRef(setFields);
  setFieldsRef.current = setFields;

  const clearDebounce = useCallback(() => {
    if (debounceRef.current != null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const flushPersist = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx.enabled || ctx.userId == null) {
      return;
    }
    const el = document.querySelector(ctx.scrollSelector);
    const scroll = el ? el.scrollTop : undefined;
    let fields;
    if (ctx.fieldKeys.length) {
      try {
        fields = subsetFields(getFieldsRef.current(), ctx.fieldKeys);
      } catch {
        fields = null;
      }
    }
    const savedAt = new Date().toISOString();
    try {
      await setPageUi({
        userId: ctx.userId,
        routeKey: ctx.routeKey,
        schemaVersion: ctx.schemaVersion,
        unitScope: ctx.unitScope,
        scroll,
        fields,
        savedAt,
      });
      lastSavedAtRef.current = savedAt;
      postPageUiBroadcast({ id: pageUiKey(ctx.userId, ctx.routeKey), savedAt });
    } catch {
      /* ponytail: fail-soft writes */
    }
  }, []);

  const schedulePersist = useCallback(() => {
    clearDebounce();
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void flushPersist();
    }, DEBOUNCE_MS);
  }, [clearDebounce, flushPersist]);

  useEffect(() => {
    let cancelled = false;
    clearDebounce();
    setHydrated(false);
    lastFieldsJsonRef.current = null;
    if (!enabled || userId == null || !persistReady) {
      return undefined;
    }
    (async () => {
      try {
        const record = await getPageUi({ userId, routeKey });
        if (cancelled) {
          return;
        }
        if (record?.schemaVersion === schemaVersion) {
          if (record.savedAt) {
            lastSavedAtRef.current = record.savedAt;
          }
          const picked = subsetFields(record.fields, fieldKeys);
          if (picked && Object.keys(picked).length) {
            setFieldsRef.current(picked);
          }
          restoreScrollTop(scrollSelector, record.scroll);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    userId,
    routeKey,
    schemaVersion,
    fieldKeys.join("|"),
    scrollSelector,
    persistReady,
    clearDebounce,
  ]);

  useEffect(() => () => clearDebounce(), [clearDebounce]);

  useEffect(() => {
    if (!enabled || !hydrated || userId == null) {
      return undefined;
    }
    const id = pageUiKey(userId, routeKey);
    return subscribePageUiBroadcast({
      onNewerPageUi: (msg) => {
        if (msg.id !== id) {
          return;
        }
        const ours = lastSavedAtRef.current;
        if (ours && msg.savedAt <= ours) {
          return;
        }
        notifyPageUiStaleFromOtherTab();
      },
    });
  }, [enabled, hydrated, userId, routeKey]);

  useEffect(() => {
    if (!enabled || !hydrated || !fieldKeys.length) {
      return;
    }
    let json;
    try {
      json = JSON.stringify(subsetFields(getFieldsRef.current(), fieldKeys));
    } catch {
      return;
    }
    if (lastFieldsJsonRef.current === json) {
      return;
    }
    lastFieldsJsonRef.current = json;
    schedulePersist();
  });

  useEffect(() => {
    if (!enabled || !hydrated) {
      return undefined;
    }
    const el = document.querySelector(scrollSelector);
    if (!el) {
      return undefined;
    }
    const onScroll = () => schedulePersist();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [enabled, hydrated, scrollSelector, schedulePersist]);

  return { hydrated };
}
