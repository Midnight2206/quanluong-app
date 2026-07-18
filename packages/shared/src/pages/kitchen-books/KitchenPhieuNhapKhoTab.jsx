"use client";

import { KitchenBooksAccessGate } from "./KitchenBooksAccessGate.jsx";
import { KitchenBooksUnitPicker } from "./KitchenBooksUnitPicker.jsx";
import { KitchenReceiptSlipWorkspace } from "./KitchenReceiptSlipWorkspace.jsx";

export function KitchenPhieuNhapKhoTab({
  selectedUnitId,
  canPickUnits,
  sortedUnits,
  setManualUnitId,
  user,
  canAccess,
}) {
  return (
    <KitchenBooksAccessGate permissionLabel="kitchenBooks.access" allowed={canAccess}>
      <div className="flex min-h-0 flex-col gap-4 p-1 sm:p-0">
        <KitchenBooksUnitPicker
          canPickUnits={canPickUnits}
          sortedUnits={sortedUnits}
          selectedUnitId={selectedUnitId}
          setManualUnitId={setManualUnitId}
          user={user}
        />

        <KitchenReceiptSlipWorkspace
          selectedUnitId={selectedUnitId}
          canWrite={canAccess}
        />
      </div>
    </KitchenBooksAccessGate>
  );
}
