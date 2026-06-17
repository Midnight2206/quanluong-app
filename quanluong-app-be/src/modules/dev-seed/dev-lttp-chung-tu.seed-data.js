/**
 * Dữ liệu mẫu dev — LTTP + chứng từ quyết toán.
 * Mặt hàng: mã "1" … "200".
 */

export const DEV_SEED_COMMODITY_COUNT = 200;

export const DEV_SEED_SLIP_NOTE = "[dev-seed-lttp-chung-tu]";

/** Số đơn vị nhận con dưới kho cấp phát «Đơn vị mẫu cấp 2». */
export const DEV_SEED_RECIPIENT_CHILD_COUNT = 6;

export const DEV_SEED_RECIPIENT_CHILD_NAME_PREFIX = "LTTP kho mẫu";

/** @deprecated alias */
export const DEV_SEED_WAREHOUSE_CHILD_COUNT = DEV_SEED_RECIPIENT_CHILD_COUNT;

/** @deprecated alias */
export const DEV_SEED_WAREHOUSE_CHILD_NAME_PREFIX = DEV_SEED_RECIPIENT_CHILD_NAME_PREFIX;

/** Kho cấp phát LTTP (danh mục + phiếu xuất). */
export const SAMPLE_CHILD_UNIT_NAME = "Đơn vị mẫu cấp 2";

export const DEV_SEED_SLIPS_PER_RECIPIENT_MONTH = 30;

/** @deprecated alias */
export const DEV_SEED_SLIPS_PER_UNIT_MONTH = DEV_SEED_SLIPS_PER_RECIPIENT_MONTH;

export const DEV_SEED_SLIP_LINES_MIN = 20;

export const DEV_SEED_SLIP_LINES_MAX = 30;

export const DEV_SEED_EXTRA_FOOD_GROUPS = [
  { code: "thuc-pham-kho", name: "Thực phẩm khô", sortOrder: 10 },
  { code: "rau-cu-qua", name: "Rau củ quả", sortOrder: 20 },
  { code: "thit-ca", name: "Thịt cá", sortOrder: 30 },
  { code: "gia-vi", name: "Gia vị", sortOrder: 40 },
];

export const DEV_SEED_MEASURE_UNITS = ["kg", "lít", "gói", "túi", "hộp", "chai", "bao"];

export const DEV_SEED_SUPPLIERS = [
  {
    name: "Công ty TNHH Thực phẩm Bắc Giang",
    representativeName: "Nguyễn Văn An",
    address: "Bắc Giang",
    taxCode: "2400123456",
  },
  {
    name: "HTX Nông sản Đồng Xanh",
    representativeName: "Trần Thị Bình",
    address: "Hà Nội",
    taxCode: "0100987654",
  },
  {
    name: "Cửa hàng LTTP Minh Phát",
    representativeName: "Lê Văn Cường",
    address: "Bắc Ninh",
    taxCode: "2300111222",
  },
  {
    name: "Nhà cung cấp Hải Đăng",
    representativeName: "Phạm Thị Dung",
    address: "Hải Phòng",
    taxCode: "0200333444",
  },
  {
    name: "Co.op Mart khu vực",
    representativeName: "Hoàng Văn Em",
    address: "Hà Nội",
    taxCode: "0100555666",
  },
];

export const DEV_SEED_CHUNG_TU_UNIT_PROFILE = {
  donViCapTren: "Sư đoàn 372",
  boPhan: "Phòng Hậu cần",
  quyenSo: "0426",
  noTaiKhoan: "111",
  coTaiKhoan: "331",
  signerNguoiMua: "Thiếu úy Trần Văn Mua",
  signerPhuTrachBoPhan: "Đại úy Lê Văn Phòng",
  signerTaiChinh: "Thượng úy Phạm Thị Tài",
  signerApprover: "Trung tá Vũ Văn Trưởng",
};

export const DEV_SEED_LTTP_FORM_DEFAULTS = {
  printLine1: "Trung đoàn 925",
  printLine2: "Cụm LTTP kho tổng",
  formMauSo: "C40",
  warehouseFrom: "Kho LTTP chính",
  signerWriter: "Thiếu úy Trần Văn Lập",
  signerApprover: "Trung tá Vũ Văn Trưởng",
};

export function bookMmyyFromYmd(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd));
  if (!m) return "0100";
  return `${m[2]}${m[1].slice(-2)}`;
}

export function parseDateOnlyUtc(ymd) {
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function ymdTodayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysYmd(ymd, delta) {
  const d = parseDateOnlyUtc(ymd);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function commodityNameForCode(codeNum) {
  return `Mặt hàng LTTP số ${codeNum}`;
}

export function unitPriceForCode(codeNum) {
  return 8000 + codeNum * 250;
}

export function buildCommodityRows(unitId, groupIds) {
  const rows = [];
  for (let i = 1; i <= DEV_SEED_COMMODITY_COUNT; i += 1) {
    const code = String(i);
    rows.push({
      unitId,
      groupId: groupIds[i % groupIds.length],
      code,
      name: commodityNameForCode(i),
      measureUnit: DEV_SEED_MEASURE_UNITS[i % DEV_SEED_MEASURE_UNITS.length],
      conversionRate: null,
      isActive: true,
    });
  }
  return rows;
}

export function recipientChildUnitName(index1Based) {
  return `${DEV_SEED_RECIPIENT_CHILD_NAME_PREFIX} ${String(index1Based).padStart(2, "0")}`;
}

/** @deprecated alias */
export function warehouseChildUnitName(index1Based) {
  return recipientChildUnitName(index1Based);
}

export function randomInt(min, max, seed = 0) {
  const span = max - min + 1;
  return min + (Math.abs(seed) % span);
}

/** Các ngày YYYY-MM-DD trong tháng hiện tại (UTC). */
export function listDaysInCurrentMonthUtc() {
  const today = ymdTodayUtc();
  const [y, m] = today.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days = [];
  for (let d = 1; d <= lastDay; d += 1) {
    days.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return days;
}

/** Gán ngày cho N phiếu trong tháng (lặp ngày nếu tháng < N ngày). */
export function scheduleSlipDaysForMonth(slipCount) {
  const days = listDaysInCurrentMonthUtc();
  if (!days.length) return [];
  const out = [];
  for (let i = 0; i < slipCount; i += 1) {
    out.push(days[i % days.length]);
  }
  return out;
}

export function currentMonthBoundsUtc() {
  const today = ymdTodayUtc();
  const [y, m] = today.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: parseDateOnlyUtc(`${y}-${String(m).padStart(2, "0")}-01`),
    to: parseDateOnlyUtc(`${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`),
    yearMonth: `${y}-${String(m).padStart(2, "0")}`,
  };
}

export function chungTuProfileForWarehouseUnit(unitName) {
  return {
    ...DEV_SEED_CHUNG_TU_UNIT_PROFILE,
    boPhan: `Bộ phận LTTP — ${unitName}`,
  };
}

export function lttpFormDefaultsForStorageUnit(unitName) {
  return {
    ...DEV_SEED_LTTP_FORM_DEFAULTS,
    printLine1: unitName,
    printLine2: "Kho cấp phát LTTP",
    warehouseFrom: `Kho LTTP — ${unitName}`,
  };
}

/** @deprecated alias */
export function lttpFormDefaultsForWarehouseUnit(unitName) {
  return lttpFormDefaultsForStorageUnit(unitName);
}
