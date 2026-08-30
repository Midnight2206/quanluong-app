function parseTongTien(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const digits = String(value).replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function buildBkmhSliceMetadata(context = {}) {
  const soChungTu =
    String(context.soChungTu ?? context.so ?? context.soPhieu ?? "").trim() || null;
  const periodDateRaw = String(context.periodDate ?? "").trim();
  const periodDate = periodDateRaw || null;
  const recipientUnitId =
    context.recipientUnitId != null ? Number(context.recipientUnitId) : null;
  const recipientUnitName =
    String(context.recipientUnitName ?? "").trim() || null;
  const ngayThangNam = String(context.ngayThangNam ?? "").trim() || null;
  const tongTien =
    parseTongTien(context.tongTienSo) ?? parseTongTien(context.tongTien);
  return {
    soChungTu,
    periodDate,
    recipientUnitId: Number.isFinite(recipientUnitId) ? recipientUnitId : null,
    recipientUnitName,
    ngayThangNam,
    tongTien,
  };
}

function sumSliceTongTien(items) {
  return items.reduce((sum, item) => sum + (Number(item?.tongTien) || 0), 0);
}

export { buildBkmhSliceMetadata, parseTongTien, sumSliceTongTien };
