import httpClient from "@/services/httpClient";
import { notifyError } from "@/services/notify";

export async function formatLttpIssueSlipPdfError(err, fallback) {
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

/**
 * Mở PDF phiếu xuất (document-service) trong tab mới.
 * Phải gọi `window.open` đồng bộ trong stack click — sau await trình duyệt chặn popup.
 * @returns {Promise<boolean>} true nếu tải/mở thành công
 */
export async function openLttpIssueSlipPdfInTab(slipId, { targetWindow = null } = {}) {
  const id = slipId != null ? String(slipId).trim() : "";
  if (!id) return false;
  const tab = targetWindow ?? window.open("about:blank", "_blank");
  if (!tab) {
    notifyError(
      "Trình duyệt chặn cửa sổ mới. Hãy cho phép popup cho trang này hoặc thử nút In trên thanh địa chỉ.",
    );
    return false;
  }
  try {
    const res = await httpClient.get(`/lttp/issue-slips/${id}/print-pdf`, {
      responseType: "blob",
    });
    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    tab.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return true;
  } catch (err) {
    tab.close();
    notifyError(await formatLttpIssueSlipPdfError(err, "Không tải được PDF phiếu xuất."));
    return false;
  }
}

export async function openLttpIssueSlipsMergedPdfInTab(ids, { targetWindow = null } = {}) {
  const list = Array.isArray(ids) ? ids.filter((id) => id != null && String(id).trim() !== "") : [];
  if (!list.length) return false;
  const tab = targetWindow ?? window.open("about:blank", "_blank");
  if (!tab) {
    notifyError("Trình duyệt chặn cửa sổ mới. Hãy cho phép popup cho trang này.");
    return false;
  }
  try {
    const res = await httpClient.post(
      "/lttp/issue-slips/print-pdfs",
      { ids: list },
      { responseType: "blob" },
    );
    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    tab.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return true;
  } catch (err) {
    tab.close();
    notifyError(await formatLttpIssueSlipPdfError(err, "Không gộp PDF các phiếu."));
    return false;
  }
}
