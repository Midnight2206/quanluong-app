import { renderSupplierDailyInvoice } from "../../services/document-service.client.js";
import { readLttpSupplierDailyInvoice } from "./lttp-supplier.service.js";

async function exportSupplierDailyInvoicePdf({ userId, supplierId, date, db, render = renderSupplierDailyInvoice }) {
  const invoice = await readLttpSupplierDailyInvoice({ userId, supplierId, date, db });
  const buffer = await render({
    date: invoice.date,
    note: invoice.note,
    seller: invoice.seller,
    buyer: invoice.buyer,
    lines: invoice.lines,
    grandTotal: invoice.grandTotal,
  });
  const fileName = `Hoa-don-NCC-${date}.pdf`;
  return { buffer, fileName, invoice };
}

export { exportSupplierDailyInvoicePdf };
