"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import {
  mapPermissionsFromUser,
  useAuthStore,
} from "@/features/auth/model/authStore";
import { invalidateLttpData } from "@/features/lttp/api/lttpApiInvalidate.js";
import { apiRequest } from "@/services/apiRequest";
import { notifyWarning } from "@/services/notify";
import { verifySessionOrRefresh } from "./auth/verifySessionOrRefresh.js";
import { createLttpOutboxHandlers } from "./adapters/lttp/lttpOutboxOps.js";
import { prefetchBoot } from "./cache/prefetch.js";
import { openOfflineDb } from "./db/openOfflineDb.js";
import { useNetworkStatus } from "./hooks/useNetworkStatus.js";
import { registerOfflineServiceWorker } from "./registerServiceWorker.js";
import { runReconnectSync } from "./runReconnectSync.js";
import { createOfflineSyncController } from "./sync/OfflineSyncController.js";
import { setNetworkProbe } from "./sync/networkStatus.js";
import { OfflineConflictDock } from "./ui/ConflictReviewDialog.jsx";
import { OfflineBanner } from "./ui/OfflineBanner.jsx";
import { OfflineChromeOffset } from "./ui/OfflineChromeOffset.jsx";
import { ReauthOverlay } from "./ui/ReauthOverlay.jsx";
import { ReconnectSyncOverlay } from "./ui/ReconnectSyncOverlay.jsx";
import { clearLocalDraftRegistry } from "@/lib/clientPersist/localDraftRegistry.js";

const RECONNECT_SYNC_TIMEOUT_MS = 45_000;
const RECONNECT_SYNC_TIMEOUT_MSG =
  "Đồng bộ quá lâu (hơn 45 giây). Kiểm tra mạng và thử lại.";

const Ctx = createContext({
  userId: null,
  ready: false,
  db: null,
  online: true,
  reconnectBlocking: false,
  reconnectError: null,
  retryReconnect: () => {},
  flushOutbox: async () => ({
    flushed: 0,
    failed: 0,
    needsReview: 0,
    authExpired: false,
    forbidden: 0,
  }),
});

export function useOffline() {
  return useContext(Ctx);
}

export function OfflineProvider({ children }) {
  const user = useCurrentUser();
  const userId = user?.id ?? null;
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  /** @type {[import("dexie").Dexie | null, (db: import("dexie").Dexie | null) => void]} */
  const [db, setDb] = useState(null);
  const { online } = useNetworkStatus();
  const [reconnectBlocking, setReconnectBlocking] = useState(false);
  const [reconnectError, setReconnectError] = useState(null);
  const [reauthRequired, setReauthRequired] = useState(false);
  const sawOfflineRef = useRef(false);
  const runIdRef = useRef(0);
  /** @type {React.MutableRefObject<ReturnType<typeof createOfflineSyncController> | null>} */
  const syncRef = useRef(null);
  const [flushOutboxFn, setFlushOutboxFn] = useState(
    /** @type {() => Promise<{ flushed: number; failed: number; needsReview: number }>} */ (
      async () => ({
        flushed: 0,
        failed: 0,
        needsReview: 0,
        authExpired: false,
        forbidden: 0,
      })
    ),
  );

  useEffect(() => {
    setNetworkProbe(async () => {
      try {
        await apiRequest({ url: "/auth/current-user", method: "get" });
        return true;
      } catch {
        return false;
      }
    });
  }, []);

  useEffect(() => {
    if (!online) {
      sawOfflineRef.current = true;
    }
  }, [online]);

  useEffect(() => {
    sawOfflineRef.current = false;
    setReconnectBlocking(false);
    setReconnectError(null);
    setReauthRequired(false);
    runIdRef.current += 1;
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setDb(null);
    clearLocalDraftRegistry();
    if (userId == null) {
      return undefined;
    }
    (async () => {
      try {
        const opened = await openOfflineDb(userId);
        if (!cancelled) {
          setDb(opened);
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setReady(true); // ponytail: fail-open without offline DB
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (userId == null || !ready) {
      return undefined;
    }
    void registerOfflineServiceWorker();
  }, [userId, ready]);

  useEffect(() => {
    if (userId == null || !ready || db == null || !online) {
      return undefined;
    }
    if (sawOfflineRef.current) {
      return undefined;
    }
    void prefetchBoot({ db, apiRequest });
  }, [userId, ready, db, online]);

  useEffect(() => {
    syncRef.current?.stop();
    syncRef.current = null;
    setFlushOutboxFn(
      async () => ({
        flushed: 0,
        failed: 0,
        needsReview: 0,
        authExpired: false,
        forbidden: 0,
      }),
    );
    if (userId == null || !ready || db == null) {
      return undefined;
    }
    const lttpHandlers = createLttpOutboxHandlers(apiRequest);
    const controller = createOfflineSyncController({
      db,
      userId,
      apiRequest,
      getHandlers: () => lttpHandlers,
      verifySessionOrRefreshFn: (opts) =>
        verifySessionOrRefresh({
          ...opts,
          setAuthState: (p) => useAuthStore.getState().setAuthState(p),
          mapPermissionsFromUser,
        }),
    });
    syncRef.current = controller;
    setFlushOutboxFn(() => async () => {
      const result = await controller.flush();
      if (result.authExpired) {
        setReauthRequired(true);
      }
      if (result.forbidden > 0) {
        notifyWarning("Bạn không có quyền thực hiện thao tác này");
      }
      if (result.flushed > 0) {
        invalidateLttpData(qc);
      }
      return result;
    });
    controller.start();
    return () => {
      controller.stop();
      if (syncRef.current === controller) {
        syncRef.current = null;
      }
    };
  }, [userId, ready, db, qc]);

  const runGate = useCallback(async () => {
    if (!sawOfflineRef.current) {
      return;
    }
    if (userId == null || !ready) {
      return;
    }
    const id = ++runIdRef.current;
    setReconnectBlocking(true);
    setReconnectError(null);
    let timeoutId;
    try {
      await Promise.race([
        runReconnectSync({
          flushOutbox: () => flushOutboxFn(),
          invalidate: () => invalidateLttpData(qc),
          refetchActive: () => qc.refetchQueries({ type: "active" }),
          prefetchBoot: () =>
            db ? prefetchBoot({ db, apiRequest }) : Promise.resolve(),
        }),
        new Promise((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error(RECONNECT_SYNC_TIMEOUT_MSG)),
            RECONNECT_SYNC_TIMEOUT_MS,
          );
        }),
      ]);
      if (id === runIdRef.current) {
        setReconnectBlocking(false);
      }
    } catch (e) {
      if (id !== runIdRef.current) return;
      if (e?.code === "AUTH_EXPIRED" || e?.message === "AUTH_EXPIRED") {
        setReauthRequired(true);
        return;
      }
      setReconnectError(
        e?.message || "Không đồng bộ được. Kiểm tra mạng và thử lại.",
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }, [userId, ready, db, qc, flushOutboxFn]);

  useEffect(() => {
    if (online) {
      void runGate();
    }
  }, [online, runGate]);

  const retryReconnect = useCallback(() => {
    void runGate();
  }, [runGate]);

  const handleReauthSuccess = useCallback(async () => {
    const session = await verifySessionOrRefresh({
      apiRequest,
      setAuthState: (p) => useAuthStore.getState().setAuthState(p),
      mapPermissionsFromUser,
    });
    if (!session.ok) return;
    setReauthRequired(false);
    if (sawOfflineRef.current) {
      void runGate();
    } else {
      void flushOutboxFn();
    }
  }, [runGate, flushOutboxFn]);

  const uiBlocking = reconnectBlocking || reauthRequired;

  return (
    <Ctx.Provider
      value={{
        userId,
        ready,
        db,
        flushOutbox: flushOutboxFn,
        online,
        reconnectBlocking,
        reconnectError,
        retryReconnect,
      }}
    >
      <OfflineBanner online={online} />
      <OfflineChromeOffset />
      {reauthRequired ? (
        <ReauthOverlay onSuccess={handleReauthSuccess} />
      ) : null}
      {reconnectBlocking && !reauthRequired ? (
        <ReconnectSyncOverlay error={reconnectError} onRetry={retryReconnect} />
      ) : null}
      <div
        aria-busy={uiBlocking || undefined}
        className={
          uiBlocking ? "pointer-events-none select-none" : undefined
        }
      >
        <OfflineConflictDock />
        {children}
      </div>
    </Ctx.Provider>
  );
}
