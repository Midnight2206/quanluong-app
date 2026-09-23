"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import { migrateLttpSessionDraftsToIdb } from "./drafts.js";
import { setNavTabPersistUserId } from "./pageUi.js";
import { openClientDb } from "./db.js";

const Ctx = createContext({ userId: null, ready: false });

export function useClientPersist() {
  return useContext(Ctx);
}

export function ClientPersistenceProvider({ children }) {
  const user = useCurrentUser();
  const userId = user?.id ?? null;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setNavTabPersistUserId(userId);
    return () => setNavTabPersistUserId(null);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    if (userId == null) {
      return undefined;
    }
    (async () => {
      try {
        await openClientDb();
        await migrateLttpSessionDraftsToIdb(userId);
        if (!cancelled) {
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setReady(true); // ponytail: fail-open without persist
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return <Ctx.Provider value={{ userId, ready }}>{children}</Ctx.Provider>;
}
