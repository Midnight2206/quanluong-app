"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCurrentUser, useHasPermission } from "@/features/auth/model/authSlice";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import { useGetUnitsQuery } from "@/features/units/api/unitsApi";
import { useTargetUnitScope } from "@/contexts/TargetUnitScopeContext";
import { useDraftPersist } from "@/hooks/useDraftPersist";
import {
  readStoredManualUnitId,
  writeStoredManualUnitId,
} from "@/pages/lttpNhapXuat/lttpNhapXuatSessionPersist";
import {
  resolveDefaultLttpStorageUnitId,
  unitsForLttpUnitPicker,
} from "@/pages/lttpNhapXuat/lttpStorageUnitDefault";

/**
 * Chọn đơn vị kho LTTP dùng chung cho Xuất chứng từ / Lịch sử.
 */
export function useChungTuUnitScope() {
  const user = useCurrentUser();
  const canPickUnits = useHasPermission(PERMISSIONS.UNITS_READ);
  const { workingUnitId, isPrivileged } = useTargetUnitScope();

  const { data: unitsData } = useGetUnitsQuery(undefined, { skip: !canPickUnits });
  const units = unitsData ?? [];
  const defaultUnitId = user?.unit?.id != null ? Number(user.unit.id) : null;

  const unitsForDropdown = useMemo(
    () =>
      unitsForLttpUnitPicker(units, {
        defaultUnitId,
        isPrivileged,
        userUnitName: user?.unit?.name,
      }),
    [units, defaultUnitId, isPrivileged, user?.unit?.name],
  );

  const selectedUnitId = useMemo(() => {
    if (!canPickUnits) return defaultUnitId;
    if (workingUnitId != null) return Number(workingUnitId);
    const fallback =
      !isPrivileged && defaultUnitId != null
        ? defaultUnitId
        : units.length
          ? units[0]?.id
          : defaultUnitId;
    return resolveDefaultLttpStorageUnitId(unitsForDropdown, fallback);
  }, [canPickUnits, defaultUnitId, isPrivileged, workingUnitId, units, unitsForDropdown]);

  const [manualUnitId, setManualUnitId] = useState(null);
  const effectiveUnitId = manualUnitId ?? selectedUnitId;

  const {
    draft: manualUnitDraft,
    setDraftPayload: persistManualUnitDraft,
    ready: manualUnitPersistReady,
  } = useDraftPersist({
    draftType: "shared-manual-unit",
    scopeId: "global",
    enabled: canPickUnits,
  });

  const hydrateDoneRef = useRef(false);

  useLayoutEffect(() => {
    if (!canPickUnits || !unitsForDropdown.length || !manualUnitPersistReady) {
      return;
    }
    if (hydrateDoneRef.current) {
      return;
    }
    hydrateDoneRef.current = true;
    const allowedIds = new Set(unitsForDropdown.map((u) => Number(u.id)));
    let stored =
      manualUnitDraft?.manualUnitId != null ? Number(manualUnitDraft.manualUnitId) : null;
    if (stored == null || !allowedIds.has(stored)) {
      const sessionStored = readStoredManualUnitId();
      if (sessionStored != null && allowedIds.has(Number(sessionStored))) {
        stored = Number(sessionStored);
        persistManualUnitDraft({ manualUnitId: stored });
      }
    }
    try {
      writeStoredManualUnitId(null);
    } catch {
      /* ignore */
    }
    if (stored != null && allowedIds.has(stored)) {
      setManualUnitId(stored);
    }
  }, [
    canPickUnits,
    unitsForDropdown,
    manualUnitPersistReady,
    manualUnitDraft,
    persistManualUnitDraft,
  ]);

  useEffect(() => {
    hydrateDoneRef.current = false;
  }, [user?.id]);

  const persistManualUnitId = useCallback(
    (id) => {
      setManualUnitId(id);
      if (id != null) {
        persistManualUnitDraft({ manualUnitId: Number(id) });
      }
    },
    [persistManualUnitDraft],
  );

  return {
    canPickUnits,
    unitsForDropdown,
    effectiveUnitId,
    persistManualUnitId,
  };
}
