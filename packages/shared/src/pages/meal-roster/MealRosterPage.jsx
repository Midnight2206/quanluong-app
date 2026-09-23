"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { TabPanel } from "@/components/common/TabPanel";
import { useCurrentUser, useHasPermission } from "@/features/auth/model/authSlice";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import { useGetUnitsQuery } from "@/features/units/api/unitsApi";
import { useTargetUnitScope } from "@/contexts/TargetUnitScopeContext";
import { useDraftPersist } from "@/hooks/useDraftPersist";
import { MealRosterGuarantyTab } from "./MealRosterGuarantyTab.jsx";
import { MealRosterLedgerTab } from "./MealRosterLedgerTab.jsx";

function localYearMonth(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function sortUnitsByPath(units) {
  return [...(units || [])].sort((a, b) => (a.path || "").localeCompare(b.path || ""));
}

export function MealRosterPage() {
  const user = useCurrentUser();
  const { workingUnitId } = useTargetUnitScope();
  const canAccess = useHasPermission(PERMISSIONS.MEAL_ROSTER_ACCESS);
  const canPickUnits = useHasPermission(PERMISSIONS.UNITS_READ);

  const { data: unitsData } = useGetUnitsQuery(undefined, { skip: !canPickUnits });
  const units = unitsData ?? [];
  const sortedUnits = useMemo(() => sortUnitsByPath(units), [units]);

  const defaultUnitId = user?.unit?.id != null ? Number(user.unit.id) : null;

  const scopeUnitId = useMemo(() => {
    if (!canPickUnits) {
      return defaultUnitId;
    }
    if (workingUnitId != null) {
      return Number(workingUnitId);
    }
    if (sortedUnits.length) {
      return sortedUnits[0].id;
    }
    return defaultUnitId;
  }, [canPickUnits, workingUnitId, sortedUnits, defaultUnitId]);

  const [manualUnitId, setManualUnitId] = useState(null);
  useEffect(() => {
    setManualUnitId(null);
  }, [workingUnitId]);

  const selectedUnitId = manualUnitId ?? scopeUnitId;

  const [yearMonth, setYearMonth] = useState(() => localYearMonth());

  const {
    draft: shellDraft,
    setDraftPayload: persistShellDraft,
    ready: shellPersistReady,
  } = useDraftPersist({
    draftType: "meal-roster-shell",
    scopeId: "global",
    enabled: canAccess,
  });
  const shellHydratedRef = useRef(false);
  const shellReadyRef = useRef(false);

  useLayoutEffect(() => {
    shellReadyRef.current = false;
    if (!canAccess || !shellPersistReady) {
      return;
    }
    if (shellHydratedRef.current) {
      shellReadyRef.current = true;
      return;
    }
    shellHydratedRef.current = true;
    const stored = shellDraft;
    if (typeof stored?.yearMonth === "string" && /^\d{4}-\d{2}$/.test(stored.yearMonth)) {
      setYearMonth(stored.yearMonth);
    }
    if (canPickUnits && stored?.manualUnitId != null && sortedUnits.length) {
      const id = Number(stored.manualUnitId);
      const allowed = sortedUnits.some((u) => Number(u.id) === id);
      if (allowed) {
        setManualUnitId(id);
      }
    }
    shellReadyRef.current = true;
  }, [canAccess, canPickUnits, shellPersistReady, sortedUnits]); // eslint-disable-line react-hooks/exhaustive-deps -- hydrate once when ready

  useEffect(() => {
    shellHydratedRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    if (!shellReadyRef.current || !shellPersistReady || !canAccess) {
      return;
    }
    persistShellDraft({
      yearMonth,
      manualUnitId: manualUnitId != null ? Number(manualUnitId) : null,
    });
  }, [yearMonth, manualUnitId, shellPersistReady, canAccess, persistShellDraft]);

  const tabProps = {
    selectedUnitId,
    yearMonth,
    setYearMonth,
    canAccess,
    canPickUnits,
    workingUnitId,
    sortedUnits,
    manualUnitId,
    setManualUnitId,
    user,
  };

  return (
    <section className="min-w-0 pb-6">
      <TabPanel
        scrollablePanel={false}
        stickyTabList
        equalWidthTabs
        persistId="meal-roster-main"
        defaultTabId="guaranty"
        tabs={[
          {
            id: "guaranty",
            label: "Danh sách bảo đảm",
            panel: <MealRosterGuarantyTab {...tabProps} />,
          },
          {
            id: "ledger",
            label: "Sổ chấm cơm",
            panel: (
              <MealRosterLedgerTab
                {...tabProps}
                stickyTabListLevel={1}
              />
            ),
          },
        ]}
      />
    </section>
  );
}
