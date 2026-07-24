"use client";

import { TabPanel } from "@/components/common/TabPanel";
import { useHasPermission } from "@/features/auth/model/authSlice";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import { KitchenBooksAccessGate } from "./KitchenBooksAccessGate.jsx";
import { KitchenMenuDetailTab } from "./KitchenMenuDetailTab.jsx";
import { KitchenMenuTab } from "./KitchenMenuTab.jsx";

function KitchenWeeklyLttpPlanPlaceholder() {
  return (
    <div className="p-4 text-sm text-muted-foreground">
      Kế hoạch LTTP tuần — sắp có.
    </div>
  );
}

export function KitchenSoThucDonTab(props) {
  const canAccess = useHasPermission(PERMISSIONS.KITCHEN_BOOKS_ACCESS);

  const tabs = [
    {
      id: "chi-tiet",
      label: "Thực đơn chi tiết",
      panel: <KitchenMenuDetailTab {...props} canAccess={canAccess} />,
    },
    {
      id: "so-thuc-don",
      label: "Sổ thực đơn",
      panel: <KitchenMenuTab {...props} canAccess={canAccess} />,
    },
    {
      id: "ke-hoach-tuan",
      label: "Kế hoạch LTTP tuần",
      panel: <KitchenWeeklyLttpPlanPlaceholder />,
    },
  ];

  return (
    <KitchenBooksAccessGate permissionLabel="kitchenBooks.access" allowed={canAccess}>
      <TabPanel
        persistId="kitchen-books-so-thuc-don-subtabs"
        defaultTabId="chi-tiet"
        equalWidthTabs
        scrollableTabList
        scrollablePanel={false}
        stickyTabList
        stickyTabListLevel={1}
        fullBleedInCard
        tabs={tabs}
      />
    </KitchenBooksAccessGate>
  );
}
