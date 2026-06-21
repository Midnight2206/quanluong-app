"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCurrentUser, useHasPermission } from "@/features/auth/model/authSlice";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import { useGetUnitsQuery } from "@/features/units/api/unitsApi";
import { useTargetUnitScope } from "@/contexts/TargetUnitScopeContext";
import { readStoredManualUnitId, writeStoredManualUnitId } from "@/pages/lttpNhapXuat/lttpNhapXuatSessionPersist";
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

  useEffect(() => {
    if (!canPickUnits || !unitsForDropdown.length) return;
    const stored = readStoredManualUnitId();
    if (stored == null) return;
    const allowedIds = new Set(unitsForDropdown.map((u) => Number(u.id)));
    if (allowedIds.has(Number(stored))) {
      setManualUnitId(stored);
    }
  }, [canPickUnits, unitsForDropdown]);

  const persistManualUnitId = useCallback((id) => {
    setManualUnitId(id);
    writeStoredManualUnitId(id);
  }, []);

  return {
    canPickUnits,
    unitsForDropdown,
    effectiveUnitId,
    persistManualUnitId,
  };
}
