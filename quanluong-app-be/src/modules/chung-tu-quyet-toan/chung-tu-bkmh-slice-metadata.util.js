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

function toFiniteNumber(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildBkmhSliceDetailRowsSnapshot(context = {}) {
  const rows = Array.isArray(context.detailRows) ? context.detailRows : [];
  return rows.map((row, index) => {
    const quantity =
      toFiniteNumber(row?.quantity) ??
      toFiniteNumber(row?.soLuong) ??
      toFiniteNumber(row?.thucNhap);
    const unitPrice =
      toFiniteNumber(row?.unitPrice) ?? parseTongTien(row?.donGia);
    const amount =
      toFiniteNumber(row?.amount) ?? parseTongTien(row?.thanhTien);
    const commodityId = toFiniteNumber(row?.commodityId);
    return {
      ...row,
      stt: row?.stt ?? index + 1,
      commodityId: commodityId != null && commodityId > 0 ? commodityId : null,
      quantity,
      unitPrice,
      amount,
    };
  });
}

function parseBkmhSliceDetailRowsJson(json) {
  return Array.isArray(json) ? json : [];
}

export {
  buildBkmhSliceMetadata,
  buildBkmhSliceDetailRowsSnapshot,
  parseBkmhSliceDetailRowsJson,
  parseTongTien,
  sumSliceTongTien,
};
