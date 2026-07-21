"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TabPanel } from "@/components/common/TabPanel";
import { useCurrentUser, useHasPermission } from "@/features/auth/model/authSlice";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import { useGetUnitsQuery } from "@/features/units/api/unitsApi";
import { useTargetUnitScope } from "@/contexts/TargetUnitScopeContext";
import { MealRosterGuarantyTab } from "@/pages/meal-roster/MealRosterGuarantyTab.jsx";
import { MealRosterLedgerTab } from "@/pages/meal-roster/MealRosterLedgerTab.jsx";
import { KitchenDishCatalogTab } from "./KitchenDishCatalogTab.jsx";
import { KitchenPhieuNhapKhoTab } from "./KitchenPhieuNhapKhoTab.jsx";
import { KitchenPhieuXuatKhoTab } from "./KitchenPhieuXuatKhoTab.jsx";
import { KitchenSoNhapXuatLttpTab } from "./KitchenSoNhapXuatLttpTab.jsx";
import { KitchenSoTheoDoiLttpTab } from "./KitchenSoTheoDoiLttpTab.jsx";
import { KitchenSoThucDonTab } from "./KitchenSoThucDonTab.jsx";
import { KITCHEN_BOOKS_MAIN_TAB_IDS } from "./kitchenBooksTabIds.js";
import {
  readStoredKitchenManualUnitId,
  readStoredKitchenMenuDate,
  readStoredKitchenYearMonth,
  writeStoredKitchenManualUnitId,
  writeStoredKitchenMenuDate,
  writeStoredKitchenYearMonth,
} from "./kitchenBooksSessionPersist.js";

function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localYearMonth(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function sortUnitsByPath(units) {
  return [...(units || [])].sort((a, b) => (a.path || "").localeCompare(b.path || ""));
}

export function KitchenBooksPage() {
  const searchParams = useSearchParams();
  const user = useCurrentUser();
  const { workingUnitId } = useTargetUnitScope();
  const canAccessMealRoster = useHasPermission(PERMISSIONS.MEAL_ROSTER_ACCESS);
  const canAccessKitchenBooks = useHasPermission(PERMISSIONS.KITCHEN_BOOKS_ACCESS);
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

  const [manualUnitId, setManualUnitIdState] = useState(null);
  const didRestoreManualUnitRef = useRef(false);

  useEffect(() => {
    didRestoreManualUnitRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    if (!canPickUnits || !sortedUnits.length || didRestoreManualUnitRef.current) {
      return;
    }
    didRestoreManualUnitRef.current = true;
    const allowedIds = new Set(sortedUnits.map((u) => Number(u.id)));
    const stored = readStoredKitchenManualUnitId();
    if (stored != null && allowedIds.has(Number(stored))) {
      setManualUnitIdState(stored);
    }
  }, [canPickUnits, sortedUnits]);

  const prevWorkingUnitIdRef = useRef(undefined);
  useEffect(() => {
    const prev = prevWorkingUnitIdRef.current;
    prevWorkingUnitIdRef.current = workingUnitId;
    // Mount / hydrate null→id: giữ đơn vị đã chọn trong session.
    if (prev === undefined || prev === workingUnitId) {
      return;
    }
    if (prev == null && workingUnitId != null) {
      return;
    }
    setManualUnitIdState(null);
    writeStoredKitchenManualUnitId(null);
    didRestoreManualUnitRef.current = false;
  }, [workingUnitId]);

  const persistManualUnitId = useCallback((next) => {
    const id = next == null || next === "" ? null : Number(next);
    const safe = Number.isInteger(id) && id > 0 ? id : null;
    setManualUnitIdState(safe);
    writeStoredKitchenManualUnitId(safe);
  }, []);

  const selectedUnitId = manualUnitId ?? scopeUnitId;
  const [yearMonth, setYearMonthState] = useState(
    () => readStoredKitchenYearMonth() ?? localYearMonth(),
  );
  const [menuDate, setMenuDateState] = useState(
    () => readStoredKitchenMenuDate() ?? localDateStr(),
  );

  const setYearMonth = useCallback((next) => {
    setYearMonthState(next);
    writeStoredKitchenYearMonth(next);
  }, []);

  const setMenuDate = useCallback((next) => {
    setMenuDateState(next);
    writeStoredKitchenMenuDate(next);
  }, []);

  const unitShellProps = {
    selectedUnitId,
    canPickUnits,
    workingUnitId,
    sortedUnits,
    manualUnitId,
    setManualUnitId: persistManualUnitId,
    user,
  };

  const mealRosterTabProps = {
    ...unitShellProps,
    yearMonth,
    setYearMonth,
    canAccess: canAccessMealRoster,
  };

  const catalogTabProps = {
    ...unitShellProps,
    canAccess: canAccessKitchenBooks,
  };

  const menuTabProps = {
    ...unitShellProps,
    menuDate,
    setMenuDate,
    yearMonth: menuDate.slice(0, 7),
    canAccess: canAccessKitchenBooks,
  };

  const tabs = [];
  if (canAccessMealRoster) {
    tabs.push(
      {
        id: "guaranty",
        label: "Danh sách bảo đảm",
        panel: <MealRosterGuarantyTab {...mealRosterTabProps} />,
      },
      {
        id: "ledger",
        label: "Sổ chấm cơm",
        panel: (
          <MealRosterLedgerTab
            {...mealRosterTabProps}
            stickyTabListLevel={1}
          />
        ),
      },
    );
  }
  if (canAccessKitchenBooks) {
    tabs.push(
      {
        id: "catalog",
        label: "Danh mục món",
        panel: <KitchenDishCatalogTab {...catalogTabProps} />,
      },
      {
        id: "phieu-nhap-kho",
        label: "Phiếu nhập kho",
        panel: (
          <KitchenPhieuNhapKhoTab {...catalogTabProps} />
        ),
      },
      {
        id: "phieu-xuat-kho",
        label: "Phiếu xuất kho",
        panel: <KitchenPhieuXuatKhoTab />,
      },
      {
        id: "so-nhap-xuat-lttp",
        label: "Sổ nhập xuất LTTP",
        panel: <KitchenSoNhapXuatLttpTab />,
      },
      {
        id: "so-thuc-don",
        label: "Sổ thực đơn",
        panel: <KitchenSoThucDonTab {...menuTabProps} />,
      },
      {
        id: "so-theo-doi-lttp",
        label: "Sổ theo dõi LTTP tại kho",
        panel: <KitchenSoTheoDoiLttpTab />,
      },
    );
  }

  const tabFromUrl = searchParams.get("tab");
  const forcedActiveTabId =
    tabFromUrl && KITCHEN_BOOKS_MAIN_TAB_IDS.includes(tabFromUrl) && tabs.some((t) => t.id === tabFromUrl)
      ? tabFromUrl
      : undefined;

  const defaultTabId =
    tabs.find((t) => t.id === "guaranty")?.id ??
    tabs.find((t) => t.id === "so-thuc-don")?.id ??
    tabs[0]?.id;

  const canAccessPage = canAccessMealRoster || canAccessKitchenBooks;

  if (!canAccessPage) {
    return (
      <section className="p-6 text-sm text-muted-foreground">
        Bạn không có quyền truy cập Sổ sách bếp ăn.
      </section>
    );
  }

  if (!tabs.length) {
    return null;
  }

  return (
    <section className="min-w-0 pb-6">
      <TabPanel
        scrollablePanel={false}
        stickyTabList
        scrollableTabList
        equalWidthTabs={false}
        persistId="kitchen-books-main"
        defaultTabId={defaultTabId}
        forcedActiveTabId={forcedActiveTabId}
        tabs={tabs}
      />
    </section>
  );
}
