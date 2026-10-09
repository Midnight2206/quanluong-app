import assert from "node:assert/strict";
import test from "node:test";
import { buildOrderSharePlainText, orderSupplierFilterLabel } from "./lttpOrderingMatrix.js";

test("order text is one slip block per column and one line per item", () => {
  const text = buildOrderSharePlainText({
    orderDate: "2026-10-08",
    storageUnitName: "Kho A",
    supplierFilterLabel: "Rau sạch",
    slipColumns: [
      {
        recipientUnitName: "Bếp: 1",
        bookMmyy: "1026",
        slipNo: 3,
        note: "Sáng",
        lines: [
          { name: "Cải", quantity: 2, quantityFormatted: "2", lineNote: "non" },
          { name: "Hành", quantity: 0, quantityFormatted: "0" },
        ],
      },
    ],
  });
  assert.equal(
    text,
    [
      "Tổng hợp đặt hàng LTTP — 2026-10-08",
      "Kho cấp phát: Kho A",
      "Lọc đối tác (dòng phiếu): Rau sạch",
      "",
      "Bếp 1 | Q.1026-0003 (Sáng)",
      "Cải:2 (non)",
    ].join("\n"),
  );
  assert.equal(orderSupplierFilterLabel({ supplierFilter: 4, availableSuppliers: [{ id: 4, name: "Rau sạch" }] }), "Rau sạch");
});
