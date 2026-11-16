import httpClient from "@/services/httpClient";
import { notifyError } from "@/services/notify";

async function formatPdfError(err, fallback) {
  const data = err?.response?.data ?? err?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text);
      return parsed?.message || fallback;
    } catch {
      return fallback;
    }
  }
  return err?.data?.message || err?.message || fallback;
}

/** Mở PDF hoá đơn NCC trong tab mới (window.open đồng bộ trước await). */
export async function openSupplierDailyInvoicePdfInTab(
  { date, supplierId },
  { targetWindow = null } = {},
) {
  if (!date || supplierId == null) return false;
  const tab = targetWindow ?? window.open("about:blank", "_blank");
  if (!tab) {
    notifyError("Trình duyệt chặn cửa sổ mới. Hãy cho phép popup.");
    return false;
  }
  try {
    const res = await httpClient.get("/lttp-supplier/daily-invoice/print-pdf", {
      params: { date, supplierId },
      responseType: "blob",
    });
    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    tab.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return true;
  } catch (err) {
    tab.close();
    notifyError(await formatPdfError(err, "Không tải được PDF hoá đơn."));
    return false;
  }
}
