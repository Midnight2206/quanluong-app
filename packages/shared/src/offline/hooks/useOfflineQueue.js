"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/services/apiRequest";
import {
  fetchServerEntityForItem,
  patchKeepServer,
  patchReapply,
} from "../outbox/conflictReview.js";
import { flushOutbox } from "../outbox/processor.js";
import { createLttpOutboxHandlers } from "../adapters/lttp/lttpOutboxOps.js";
import { useOffline } from "../OfflineProvider.jsx";

function nowIso() {
  return new Date().toISOString();
}

const NOOP_FLUSH = {
  flushed: 0,
  failed: 0,
  needsReview: 0,
  authExpired: false,
  forbidden: 0,
};

async function loadOutboxSnapshot(db, userId) {
  if (!db || userId == null) {
    return [];
  }
  return db.table("outbox").where("userId").equals(Number(userId)).toArray();
}

export function useOfflineQueue() {
  const { db, userId, ready, flushOutbox: flushFromProvider } = useOffline();
  const [items, setItems] = useState([]);

  const refresh = useCallback(async () => {
    if (!db || userId == null) {
      setItems([]);
      return;
    }
    setItems(await loadOutboxSnapshot(db, userId));
  }, [db, userId]);

  useEffect(() => {
    if (!ready || !db || userId == null) {
      setItems([]);
      return undefined;
    }
    void refresh();
    return undefined;
  }, [ready, db, userId, refresh]);

  const flush = useCallback(async () => {
    if (ready && db && userId != null) {
      const result = await flushFromProvider();
      await refresh();
      return result;
    }
    if (db && userId != null) {
      // ponytail: provider still noop until sync controller effect runs
      const result = await flushOutbox(db, {
        userId,
        apiRequest,
        handlers: createLttpOutboxHandlers(apiRequest),
      });
      await refresh();
      return result;
    }
    await refresh();
    return NOOP_FLUSH;
  }, [db, userId, ready, flushFromProvider, refresh]);

  const pending = items.filter((i) => i.status === "pending" || i.status === "syncing");
  const needsReview = items.filter((i) => i.status === "needs_review");

  const keepServer = useCallback(
    async (itemId) => {
      if (!db || userId == null) {
        return;
      }
      const item = await db.table("outbox").get(itemId);
      if (!item || item.status !== "needs_review") {
        return;
      }
      await db.table("outbox").put(patchKeepServer(item, nowIso()));
      await refresh();
    },
    [db, userId, refresh],
  );

  const reapply = useCallback(
    async (itemId) => {
      if (!db || userId == null) {
        return;
      }
      const item = await db.table("outbox").get(itemId);
      if (!item || item.status !== "needs_review") {
        return;
      }
      const serverEntity = await fetchServerEntityForItem(item, apiRequest);
      await db.table("outbox").put(patchReapply(item, serverEntity, nowIso()));
      await refresh();
      void flushFromProvider();
    },
    [db, userId, refresh, flushFromProvider],
  );

  useEffect(() => {
    if (!ready || !db) {
      return undefined;
    }
    const onChange = () => void refresh();
    window.addEventListener("offline-outbox-changed", onChange);
    return () => window.removeEventListener("offline-outbox-changed", onChange);
  }, [ready, db, refresh]);

  return {
    items,
    pending,
    needsReview,
    pendingCount: pending.length,
    needsReviewCount: needsReview.length,
    refresh,
    flush,
    keepServer,
    reapply,
  };
}
