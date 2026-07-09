"use client";

import { useEffect, useMemo, useState } from "react";
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

  const [manualUnitId, setManualUnitId] = useState(null);
  useEffect(() => {
    setManualUnitId(null);
  }, [workingUnitId]);

  const selectedUnitId = manualUnitId ?? scopeUnitId;
  const [yearMonth, setYearMonth] = useState(() => localYearMonth());
  const [menuDate, setMenuDate] = useState(() => localDateStr());

  const unitShellProps = {
    selectedUnitId,
    canPickUnits,
    workingUnitId,
    sortedUnits,
    manualUnitId,
    setManualUnitId,
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
        panel: <MealRosterLedgerTab {...mealRosterTabProps} />,
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
        panel: <KitchenPhieuNhapKhoTab />,
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
