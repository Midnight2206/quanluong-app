import { parseTongTien } from "./chung-tu-bkmh-slice-metadata.util.js";

function pickTrimmedText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return null;
}

function sumDetailRowThanhTien(detailRows) {
  if (!Array.isArray(detailRows) || !detailRows.length) return null;
  let sum = 0;
  let hasAmount = false;
  for (const row of detailRows) {
    const amount = parseTongTien(row?.amount) ?? parseTongTien(row?.thanhTien);
    if (amount == null) continue;
    sum += amount;
    hasAmount = true;
  }
  return hasAmount ? sum : null;
}

/** @returns {{ soChungTu?: string, periodDate?: string, ngayThangNam?: string, tongTien?: number, recipientUnitName?: string } | null} */
function buildExportSummaryFromContext(context) {
  if (!context || typeof context !== "object" || Array.isArray(context)) return null;
  const summary = {
    soChungTu: pickTrimmedText(context.soChungTu, context.so, context.soPhieu) ?? undefined,
    periodDate: pickTrimmedText(context.periodDate, context.ngayChungTu) ?? undefined,
    ngayThangNam: pickTrimmedText(context.ngayThangNam, context.ngay_thang_nam) ?? undefined,
    tongTien:
      parseTongTien(context.tongTienSo) ??
      parseTongTien(context.tongTien) ??
      sumDetailRowThanhTien(context.detailRows) ??
      undefined,
    recipientUnitName:
      pickTrimmedText(context.recipientUnitName, context.recipientDisplayName) ?? undefined,
  };
  return Object.values(summary).some((value) => value != null) ? summary : null;
}

/** @returns {number|null} */
function sumFolderTongTien(files) {
  if (!Array.isArray(files) || !files.length) return null;
  let sum = 0;
  let hasAmount = false;
  for (const file of files) {
    const amount = Number(file?.tongTien);
    if (!Number.isFinite(amount)) continue;
    sum += amount;
    hasAmount = true;
  }
  return hasAmount ? sum : null;
}

export { buildExportSummaryFromContext, sumFolderTongTien };
