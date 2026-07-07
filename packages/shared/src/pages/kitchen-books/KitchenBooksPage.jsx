"use client";

import { useEffect, useMemo, useState } from "react";
import { TabPanel } from "@/components/common/TabPanel";
import { useCurrentUser, useHasPermission } from "@/features/auth/model/authSlice";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import { useGetUnitsQuery } from "@/features/units/api/unitsApi";
import { useTargetUnitScope } from "@/contexts/TargetUnitScopeContext";
import { KitchenDishCatalogTab } from "./KitchenDishCatalogTab.jsx";
import { KitchenMenuTab } from "./KitchenMenuTab.jsx";

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
  const user = useCurrentUser();
  const { workingUnitId } = useTargetUnitScope();
  const canAccess = useHasPermission(PERMISSIONS.KITCHEN_BOOKS_ACCESS);
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
  const [menuDate, setMenuDate] = useState(() => localDateStr());
  const yearMonth = menuDate.slice(0, 7);

  const tabProps = {
    selectedUnitId,
    menuDate,
    setMenuDate,
    yearMonth,
    canAccess,
    canPickUnits,
    workingUnitId,
    sortedUnits,
    manualUnitId,
    setManualUnitId,
    user,
  };

  if (!canAccess) {
    return (
      <section className="p-6 text-sm text-muted-foreground">
        Bạn không có quyền truy cập Sổ sách bếp ăn.
      </section>
    );
  }

  return (
    <section className="min-w-0 pb-6">
      <TabPanel
        scrollablePanel={false}
        stickyTabList
        equalWidthTabs
        persistId="kitchen-books-main"
        defaultTabId="menu"
        tabs={[
          {
            id: "menu",
            label: "Thực đơn",
            panel: <KitchenMenuTab {...tabProps} />,
          },
          {
            id: "catalog",
            label: "Danh mục món",
            panel: <KitchenDishCatalogTab {...tabProps} />,
          },
          {
            id: "summary",
            label: "Tổng hợp",
            disabled: true,
            panel: (
              <p className="p-4 text-sm text-muted-foreground">
                Tính năng tổng hợp tháng sẽ có trong giai đoạn sau.
              </p>
            ),
          },
        ]}
      />
    </section>
  );
}
