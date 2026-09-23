import { verifySessionOrRefresh as defaultVerify } from "../auth/verifySessionOrRefresh.js";
import { flushOutbox } from "../outbox/processor.js";
import { getNetworkOnline, subscribeNetworkStatus } from "./networkStatus.js";

const EMPTY = {
  flushed: 0,
  failed: 0,
  needsReview: 0,
  authExpired: false,
  forbidden: 0,
};

/**
 * @param {{
 *   db: import("dexie").Dexie;
 *   userId: string|number;
 *   apiRequest: (opts: Record<string, unknown>) => Promise<unknown>;
 *   getHandlers?: () => {
 *     refetchEntity?: (item: import("../outbox/operations.js").OutboxItem) => Promise<Record<string, unknown>|null>;
 *     applyUpdate?: (item: import("../outbox/operations.js").OutboxItem, serverEntity: Record<string, unknown>) => Promise<void>;
 *   };
 *   flushOutboxFn?: typeof flushOutbox;
 *   _flushOutboxForTest?: typeof flushOutbox;
 *   getNetworkOnlineFn?: typeof getNetworkOnline;
 *   subscribeNetworkStatusFn?: typeof subscribeNetworkStatus;
 *   verifySessionOrRefreshFn?: typeof defaultVerify;
 * }} opts
 */
export function createOfflineSyncController({
  db,
  userId,
  apiRequest,
  getHandlers,
  flushOutboxFn = flushOutbox,
  _flushOutboxForTest,
  getNetworkOnlineFn = getNetworkOnline,
  subscribeNetworkStatusFn = subscribeNetworkStatus,
  verifySessionOrRefreshFn = defaultVerify,
}) {
  const flushOutboxImpl = _flushOutboxForTest ?? flushOutboxFn;
  let running = false;
  /** @type {Promise<{ flushed: number; failed: number; needsReview: number; authExpired: boolean; forbidden: number }> | null} */
  let inFlight = null;
  /** @type {(() => void) | null} */
  let unsub = null;

  /** @returns {Promise<{ flushed: number; failed: number; needsReview: number; authExpired: boolean; forbidden: number }>} */
  function flush() {
    if (!running || db == null || userId == null) {
      return Promise.resolve({ ...EMPTY });
    }
    if (!getNetworkOnlineFn()) {
      return Promise.resolve({ ...EMPTY });
    }
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const session = await verifySessionOrRefreshFn({ apiRequest });
        if (!session?.ok) {
          return { ...EMPTY, authExpired: true };
        }
        return await flushOutboxImpl(db, {
          userId,
          apiRequest,
          handlers: getHandlers?.() ?? {},
        });
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  function start() {
    if (running) {
      return;
    }
    running = true;
    unsub = subscribeNetworkStatusFn((online) => {
      if (online) {
        void flush();
      }
    });
    if (getNetworkOnlineFn()) {
      void flush();
    }
  }

  function stop() {
    running = false;
    unsub?.();
    unsub = null;
  }

  return { start, stop, flush };
}
