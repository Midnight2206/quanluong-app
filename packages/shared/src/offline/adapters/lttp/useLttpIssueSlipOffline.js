"use client";

import { useCallback } from "react";
import { notifyError } from "@/services/notify";
import { useOffline } from "../../OfflineProvider.jsx";
import {
  enqueueLttpIssueSlipCreate,
  enqueueLttpIssueSlipUpdate,
  isOutboxEligibleError,
  issueSlipBaseVersion,
} from "./lttpOutboxOps.js";

export { isOutboxEligibleError };

function offlineDbUnavailable() {
  notifyError("Không lưu được hàng đợi ngoại tuyến (chưa sẵn sàng).");
}

/**
 * Dexie outbox enqueue for LTTP issue slips (create + versioned update).
 */
export function useLttpIssueSlipOffline() {
  const { db, userId } = useOffline();

  const enqueueCreate = useCallback(
    async (body) => {
      if (db == null || userId == null) {
        offlineDbUnavailable();
        throw new Error("offline: db unavailable");
      }
      return enqueueLttpIssueSlipCreate(db, userId, body);
    },
    [db, userId],
  );

  const enqueueUpdate = useCallback(
    async (slip, bodyWithoutId) => {
      if (db == null || userId == null) {
        offlineDbUnavailable();
        throw new Error("offline: db unavailable");
      }
      const slipId = slip?.id;
      if (slipId == null) {
        throw new Error("offline: slip id required");
      }
      return enqueueLttpIssueSlipUpdate(
        db,
        userId,
        slipId,
        bodyWithoutId,
        issueSlipBaseVersion(slip),
      );
    },
    [db, userId],
  );

  const isOfflineLikeError = useCallback((err) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return true;
    }
    return isOutboxEligibleError(err);
  }, []);

  return {
    enqueueCreate,
    enqueueUpdate,
    isOfflineLikeError,
    issueSlipBaseVersion,
  };
}
