import { useCallback, useEffect, useMemo, useState } from "react";
import { useClientPersist } from "@/lib/clientPersist/ClientPersistenceProvider.jsx";
import { getNavTab, getNavTabPersistUserId, setNavTab } from "@/lib/clientPersist/pageUi.js";

const STORAGE_PREFIX = "quanluong:navTab:";

function storageKey(persistId) {
  return `${STORAGE_PREFIX}${persistId}`;
}

function writeSessionNavTab(persistId, value) {
  if (!persistId || typeof sessionStorage === "undefined" || value == null || value === "") {
    return;
  }
  try {
    sessionStorage.setItem(storageKey(persistId), String(value));
  } catch {
    /* ignore */
  }
}

function mirrorNavTabToIdb(persistId, value) {
  const userId = getNavTabPersistUserId();
  if (userId == null || !persistId || value == null || value === "") {
    return;
  }
  void setNavTab({ userId, persistId, navTab: String(value) }).catch(() => {});
}

/**
 * Đọc tab đã lưu; chỉ trả về nếu nằm trong `validIds`.
 * @param {string} persistId
 * @param {string[]} validIds
 * @returns {string | null}
 */
export function readPersistedNavTab(persistId, validIds) {
  if (!persistId || typeof sessionStorage === "undefined" || !validIds?.length) {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(storageKey(persistId));
    if (raw != null && raw !== "" && validIds.includes(raw)) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * @param {string} persistId
 * @param {string} value
 */
export function writePersistedNavTab(persistId, value) {
  writeSessionNavTab(persistId, value);
  mirrorNavTabToIdb(persistId, value);
}

/** Đọc chuỗi đã lưu (không lọc) — dùng redirect khi đã validate tay. */
export function readRawPersistedNavTab(persistId) {
  if (!persistId || typeof sessionStorage === "undefined") {
    return null;
  }
  try {
    return sessionStorage.getItem(storageKey(persistId));
  } catch {
    return null;
  }
}

/** Session trước; nếu trống thì đọc IDB và ghi session (cold start redirect). */
export async function resolveRawPersistedNavTab(persistId, userId) {
  const fromSession = readRawPersistedNavTab(persistId);
  if (fromSession != null && fromSession !== "") {
    return fromSession;
  }
  if (userId == null) {
    return null;
  }
  try {
    const fromIdb = await getNavTab({ userId, persistId });
    if (fromIdb) {
      writeSessionNavTab(persistId, fromIdb);
      return fromIdb;
    }
  } catch {
    /* ponytail: fail-soft hydrate */
  }
  return null;
}

/**
 * State tab cục bộ + ghi sessionStorage khi đổi (dùng cho TabPanel hoặc tab không gắn URL).
 *
 * @param {string | null} persistId — `null` → không đọc/ghi storage
 * @param {string[]} validIds — danh sách id hợp lệ (thứ tự quan trọng cho fallback)
 * @param {string} [fallbackId] — mặc định khi không có bản ghi / id không còn hợp lệ
 * @returns {[string, (id: string) => void]}
 */
export function usePersistedNavTabSelection(persistId, validIds, fallbackId) {
  const { userId, ready: persistReady } = useClientPersist();
  const first = fallbackId ?? validIds[0] ?? "";
  const validIdsKey = validIds.join("|");
  // validIdsKey thay cho tham chiếu mảng (tránh mảng mới mỗi render → effect lặp / setState vô hạn)
  const stableValid = useMemo(() => [...validIds], [validIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps -- đồng bộ nội dung qua validIdsKey

  const [activeId, setActiveIdInternal] = useState(() => {
    if (!stableValid.length) {
      return first;
    }
    if (persistId) {
      return readPersistedNavTab(persistId, stableValid) ?? first;
    }
    return first;
  });

  useEffect(() => {
    if (!persistId || userId == null || !persistReady || !stableValid.length) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const fromSession = readPersistedNavTab(persistId, stableValid);
        const fromIdbRaw = await getNavTab({ userId, persistId });
        const fromIdb =
          fromIdbRaw && stableValid.includes(fromIdbRaw) ? fromIdbRaw : null;

        if (!fromSession && fromIdb) {
          writeSessionNavTab(persistId, fromIdb);
          if (!cancelled) {
            setActiveIdInternal(fromIdb);
          }
          return;
        }
        if (fromSession && !fromIdb) {
          await setNavTab({ userId, persistId, navTab: fromSession });
          return;
        }
        if (fromSession && fromIdb && fromSession !== fromIdb) {
          await setNavTab({ userId, persistId, navTab: fromSession });
        }
      } catch {
        /* ponytail: fail-soft hydrate */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persistId, userId, persistReady, validIdsKey, stableValid]);

  useEffect(() => {
    if (!stableValid.length) {
      return;
    }
    if (!stableValid.includes(activeId)) {
      const next = stableValid.includes(first) ? first : stableValid[0];
      setActiveIdInternal(next);
    }
  }, [stableValid, activeId, first]);

  const setActiveId = useCallback(
    (id) => {
      if (!stableValid.includes(id)) {
        return;
      }
      setActiveIdInternal(id);
      if (persistId) {
        writePersistedNavTab(persistId, id);
      }
    },
    [persistId, stableValid],
  );

  return [activeId, setActiveId];
}

/**
 * Khi tab do URL điều khiển (`segment`), tự ghi persist để lần sau (vd. redirect index) khôi phục.
 *
 * @param {string} persistId
 * @param {string[]} validIds
 * @param {string | undefined} segment — ví dụ `lttpSub` từ `useParams`
 */
export function useSyncPersistedNavTabFromRoute(persistId, validIds, segment) {
  const validIdsKey = validIds.join("|");
  const stableValid = useMemo(() => new Set(validIds), [validIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!segment || !persistId || !stableValid.has(segment)) {
      return;
    }
    writePersistedNavTab(persistId, segment);
  }, [persistId, segment, stableValid]);
}
