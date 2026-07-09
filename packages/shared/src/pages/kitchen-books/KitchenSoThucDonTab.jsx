"use client";

import { useHasPermission } from "@/features/auth/model/authSlice";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import { KitchenMenuTab } from "./KitchenMenuTab.jsx";
import { KitchenBooksAccessGate } from "./KitchenBooksAccessGate.jsx";

export function KitchenSoThucDonTab(props) {
  const canAccess = useHasPermission(PERMISSIONS.KITCHEN_BOOKS_ACCESS);

  return (
    <KitchenBooksAccessGate permissionLabel="kitchenBooks.access" allowed={canAccess}>
      <KitchenMenuTab {...props} />
    </KitchenBooksAccessGate>
  );
}
