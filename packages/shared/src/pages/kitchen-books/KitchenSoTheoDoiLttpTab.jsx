"use client";

import { KitchenBooksAccessGate } from "./KitchenBooksAccessGate.jsx";
import { KitchenBooksUnitPicker } from "./KitchenBooksUnitPicker.jsx";
import { KitchenStockPaper } from "./KitchenStockPaper.jsx";

export function KitchenSoTheoDoiLttpTab({
  selectedUnitId,
  canPickUnits,
  sortedUnits,
  setManualUnitId,
  user,
  canAccess,
  menuDate,
  setMenuDate,
}) {
  return (
    <KitchenBooksAccessGate permissionLabel="kitchenBooks.access" allowed={canAccess}>
      <div className="flex min-h-0 flex-col gap-4 p-1 sm:p-0 lg:gap-2">
        <KitchenBooksUnitPicker
          canPickUnits={canPickUnits}
          sortedUnits={sortedUnits}
          selectedUnitId={selectedUnitId}
          setManualUnitId={setManualUnitId}
          user={user}
        />
        {selectedUnitId != null && menuDate ? (
          <KitchenStockPaper
            unitId={selectedUnitId}
            date={menuDate}
            onDate={setMenuDate}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Chọn đơn vị để mở sổ theo dõi.</p>
        )}
      </div>
    </KitchenBooksAccessGate>
  );
}
