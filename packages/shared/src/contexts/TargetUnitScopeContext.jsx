"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import { invalidateRtkTagTypes } from "@/app/query/queryKeys";
import { useGetUnitsScopeFlatQuery } from "@/features/units/api/unitsApi";
import { clearTargetUnitIdCookieClient, setTargetUnitIdCookieClient } from "@/lib/targetUnitCookie";
import { clearTargetUnitId, setTargetUnitId } from "@/services/targetUnitScope";

const TargetUnitScopeContext = createContext(null);

const INVALIDATE_TAGS = [
  "User",
  "JobTitle",
  "Registration",
  "LttpCommodity",
  "LttpPrice",
  "LttpFoodGroup",
  "Unit",
  "UnitLevelCaps",
];

function useIsPrivileged(user) {
  const t = user?.type?.name;
  return t === "admin" || t === "superadmin";
}

export function TargetUnitScopeProvider({ children }) {
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const isPrivileged = useIsPrivileged(user);

  const [workingUnitId, setWorkingUnitIdState] = useState(null);
  const skipInvalidateOnce = useRef(true);

  const { data: flatUnits = [], isFetching: flatLoading } = useGetUnitsScopeFlatQuery(undefined, {
    skip: !user || !isPrivileged,
  });

  useLayoutEffect(() => {
    if (!isPrivileged) {
      clearTargetUnitId();
      clearTargetUnitIdCookieClient();
      return;
    }
    if (workingUnitId == null) {
      clearTargetUnitId();
      clearTargetUnitIdCookieClient();
    } else {
      setTargetUnitId(workingUnitId);
      setTargetUnitIdCookieClient(workingUnitId);
    }
  }, [isPrivileged, workingUnitId]);

  useEffect(() => {
    skipInvalidateOnce.current = true;
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setWorkingUnitIdState(null);
      clearTargetUnitId();
      clearTargetUnitIdCookieClient();
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isPrivileged || !user?.id) {
      return;
    }
    if (skipInvalidateOnce.current) {
      skipInvalidateOnce.current = false;
      return;
    }
    invalidateRtkTagTypes(queryClient, INVALIDATE_TAGS);
  }, [isPrivileged, user?.id, workingUnitId, queryClient]);

  const setWorkingUnitId = useCallback((id) => {
    setWorkingUnitIdState(id == null || id === "" ? null : Number(id));
  }, []);

  const value = useMemo(
    () => ({
      workingUnitId,
      setWorkingUnitId,
      flatUnits,
      flatLoading,
      isPrivileged,
    }),
    [workingUnitId, setWorkingUnitId, flatUnits, flatLoading, isPrivileged],
  );

  return <TargetUnitScopeContext.Provider value={value}>{children}</TargetUnitScopeContext.Provider>;
}

export function useTargetUnitScope() {
  const ctx = useContext(TargetUnitScopeContext);
  if (!ctx) {
    throw new Error("useTargetUnitScope must be used within TargetUnitScopeProvider");
  }
  return ctx;
}
