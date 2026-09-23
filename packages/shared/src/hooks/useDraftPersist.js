import { useCallback, useEffect, useRef, useState } from "react";
import { useClientPersist } from "@/lib/clientPersist/ClientPersistenceProvider.jsx";
import {
  clearDraft,
  getDraft,
  setDraftEager,
} from "@/lib/clientPersist/drafts.js";
import { normalizeDraftScopeId } from "@/lib/clientPersist/keys.js";
import {
  defaultLabelForDraftType,
  removeLocalDraftEntry,
  upsertLocalDraftEntry,
} from "@/lib/clientPersist/localDraftRegistry.js";
import {
  clearLocalUnsavedFieldMarks,
  reapplyLocalUnsavedFieldMarks,
} from "@/hooks/useLocalUnsavedFieldMarks.js";

/** Preference-only drafts — keep in IDB but don't surface as "unsaved form". */
const PREFERENCE_DRAFT_TYPES = new Set([
  "lich-su-filters",
  "ordering-filters",
  "kitchen-shell",
  "meal-roster-shell",
  "shared-manual-unit",
  "chungtu-summary",
  "chungtu-history",
  "chungtu-field-catalog",
]);

function registryId(userId, draftType, scope) {
  return `${Number(userId)}|${draftType}|${scope}`;
}

/**
 * IDB draft persist — navigation-safe + local-unsaved registry for status UI.
 *
 * @param {{
 *   draftType: string,
 *   scopeId?: number | string | null,
 *   unitId?: number | string | null,
 *   enabled?: boolean,
 *   label?: string,
 * }} opts
 */
export function useDraftPersist({
  draftType,
  scopeId,
  unitId,
  enabled = true,
  label,
}) {
  const { userId, ready: persistReady } = useClientPersist();
  const resolvedScope = normalizeDraftScopeId(scopeId ?? unitId);
  const [draft, setDraftState] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const suppressWritesRef = useRef(false);
  const suppressGenRef = useRef(0);
  const suppressTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const draftSnapshotRef = useRef("");
  const trackUnsaved = !PREFERENCE_DRAFT_TYPES.has(draftType);

  const clearSuppressTimer = useCallback(() => {
    if (suppressTimerRef.current != null) {
      clearTimeout(suppressTimerRef.current);
      suppressTimerRef.current = null;
    }
  }, []);

  const markUnsaved = useCallback(() => {
    if (!trackUnsaved || userId == null || resolvedScope == null) {
      return;
    }
    upsertLocalDraftEntry(registryId(userId, draftType, resolvedScope), {
      draftType,
      label: label || defaultLabelForDraftType(draftType),
    });
  }, [trackUnsaved, userId, resolvedScope, draftType, label]);

  const unmarkUnsaved = useCallback(() => {
    if (userId == null || resolvedScope == null) {
      return;
    }
    removeLocalDraftEntry(registryId(userId, draftType, resolvedScope));
  }, [userId, resolvedScope, draftType]);

  const beginSuppressWindow = useCallback(() => {
    suppressWritesRef.current = true;
    clearSuppressTimer();
    const gen = ++suppressGenRef.current;
    suppressTimerRef.current = setTimeout(() => {
      suppressTimerRef.current = null;
      if (suppressGenRef.current !== gen) {
        return;
      }
      suppressWritesRef.current = false;
    }, 120);
  }, [clearSuppressTimer]);

  useEffect(() => {
    let cancelled = false;
    clearSuppressTimer();
    suppressWritesRef.current = false;
    setLoaded(false);
    setDraftState(null);
    draftSnapshotRef.current = "";
    if (!enabled) {
      setLoaded(true);
      return undefined;
    }
    if (userId == null || resolvedScope == null || !persistReady) {
      return undefined;
    }
    (async () => {
      try {
        const record = await getDraft({
          userId,
          draftType,
          scopeId: resolvedScope,
        });
        if (!cancelled) {
          setDraftState(record);
          try {
            draftSnapshotRef.current = record ? JSON.stringify({
              version: record.version ?? 1,
              scopeId: resolvedScope,
              ...record,
            }) : "";
          } catch {
            draftSnapshotRef.current = "";
          }
          setLoaded(true);
          beginSuppressWindow();
          if (record && trackUnsaved) {
            markUnsaved();
          }
          if (record) {
            reapplyLocalUnsavedFieldMarks();
          }
        }
      } catch {
        if (!cancelled) {
          setLoaded(true);
          beginSuppressWindow();
        }
      }
    })();
    return () => {
      cancelled = true;
      clearSuppressTimer();
      suppressWritesRef.current = false;
    };
  }, [
    userId,
    draftType,
    resolvedScope,
    enabled,
    persistReady,
    clearSuppressTimer,
    beginSuppressWindow,
    trackUnsaved,
    markUnsaved,
  ]);

  const setDraftPayload = useCallback(
    (payload) => {
      if (!enabled || userId == null || resolvedScope == null) {
        return;
      }
      if (suppressWritesRef.current) {
        return;
      }
      const numeric = /^\d+$/.test(String(resolvedScope));
      const next = {
        version: 1,
        scopeId: resolvedScope,
        ...(numeric ? { unitId: Number(resolvedScope) } : {}),
        ...payload,
      };
      let snapshot = "";
      try {
        snapshot = JSON.stringify(next);
      } catch {
        snapshot = "";
      }
      // Tránh vòng setState khi caller truyền payload equivalent mỗi render (RHF watch()).
      if (snapshot && snapshot === draftSnapshotRef.current) {
        return;
      }
      draftSnapshotRef.current = snapshot;
      setDraftState((prev) => ({
        ...(prev ?? {}),
        ...next,
      }));
      setDraftEager({
        userId,
        draftType,
        scopeId: resolvedScope,
        payload,
      });
      markUnsaved();
    },
    [userId, draftType, resolvedScope, enabled, markUnsaved],
  );

  const clear = useCallback(async () => {
    clearSuppressTimer();
    suppressWritesRef.current = false;
    unmarkUnsaved();
    clearLocalUnsavedFieldMarks();
    if (userId != null && resolvedScope != null) {
      try {
        await clearDraft({ userId, draftType, scopeId: resolvedScope });
      } catch {
        /* ignore */
      }
    }
    draftSnapshotRef.current = "";
    setDraftState(null);
  }, [userId, draftType, resolvedScope, clearSuppressTimer, unmarkUnsaved]);

  const ready = !enabled || (persistReady && loaded);

  return { draft, setDraftPayload, clear, ready, isLocalUnsaved: trackUnsaved };
}
