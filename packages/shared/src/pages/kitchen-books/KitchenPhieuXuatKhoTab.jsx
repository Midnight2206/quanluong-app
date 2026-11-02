"use client";

import { KitchenBooksAccessGate } from "./KitchenBooksAccessGate.jsx";
import { KitchenBooksUnitPicker } from "./KitchenBooksUnitPicker.jsx";
import { KitchenIssuePaper } from "./KitchenIssuePaper.jsx";

export function KitchenPhieuXuatKhoTab({
  selectedUnitId,
  canPickUnits,
  sortedUnits,
  setManualUnitId,
  user,
  canAccess,
  menuDate,
  setMenuDate,
  focusCommodityId,
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
        {selectedUnitId != null && menuDate ? (
          <KitchenIssuePaper
            unitId={selectedUnitId}
            date={menuDate}
            onDate={setMenuDate}
            canWrite={canAccess}
            focusCommodityId={focusCommodityId}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Chọn đơn vị để mở phiếu xuất.</p>
        )}
      </div>
    </KitchenBooksAccessGate>
  );
}
