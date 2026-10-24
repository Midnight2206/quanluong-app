import httpClient from "@/services/httpClient";
import { notifyError, notifySuccess, notifyWarning } from "@/services/notify";

async function pdfError(err, fallback) {
  const data = err?.response?.data ?? err?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      return parsed?.message || fallback;
    } catch {
      return fallback;
    }
  }
  return err?.data?.message || err?.message || fallback;
}

/**
 * Mở PDF sổ tháng. `window.open` phải chạy trong stack click.
 * Ngày chưa chốt vẫn in, có dấu NHÁP — header liệt kê các ngày đó.
 */
export async function openKitchenLedgerMonthPdf({ unitId, month, targetWindow = null }) {
  if (unitId == null || !month) return false;
  const tab = targetWindow ?? window.open("about:blank", "_blank");
  if (!tab) {
    notifyError("Trình duyệt chặn cửa sổ mới. Hãy cho phép popup cho trang này.");
    return false;
  }
  try {
    const res = await httpClient.get("/kitchen-books/ledger/month-pdf", {
      params: { unitId, month },
      responseType: "blob",
    });
    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    tab.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    const draft = res.headers?.["x-ledger-draft-days"];
    if (draft) {
      notifyWarning(`Các ngày chưa chốt được in NHÁP: ${draft}. Bìa sổ cũng liệt kê các ngày này.`);
    } else {
      notifySuccess("Đã xuất sổ tháng.");
    }
    return true;
  } catch (err) {
    tab.close();
    notifyError(await pdfError(err, "Không xuất được sổ tháng."));
    return false;
  }
}
