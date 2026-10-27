/**
 * Mặc định theo bếp tiểu đoàn (bộ chung). Bếp khác ghi đè theo đơn vị
 * (ví dụ ĐD5: ngưỡng 10.000, lễ tết chỉ trưa). Không chứa định mức xuất.
 * XĐ-2: tiền đã sử dụng mặc định Σ Cộng xuất (ΣS), đúng sổ đang làm.
 */
const DEFAULT_LEDGER_SETTINGS = {
  spentBasis: "total_out",
  balanceWarnThreshold: 20000,
  holidayLunchOnly: false,
  riceNamePattern: "gạo",
  levels: [
    {
      code: "72",
      dailyAmount: 72000,
      mealPrices: { sang: 14400, trua: 28800, chieu: 28800 },
    },
    {
      code: "130",
      dailyAmount: 130000,
      mealPrices: { sang: 14400, trua: 86800, chieu: 28800 },
    },
  ],
  extraRates: { benhXa: 14400, benhNhan: 54000, omTrai: 20000, leTet: 108000 },
  signatures: {
    soNhapXuat: [
      { key: "quan_ly", title: "Quản lý đơn vị", name: "" },
      { key: "truc_ban", title: "Trực ban", name: "" },
      { key: "chi_huy", title: "Chỉ huy đơn vị", name: "" },
    ],
    cktc: [
      { key: "nguoi_lap", title: "Người lập", name: "" },
      { key: "thu_truong", title: "Thủ trưởng đơn vị", name: "" },
    ],
    soThucDon: [
      { key: "bep_truong", title: "Bếp trưởng", name: "" },
      { key: "quan_ly", title: "Quản lý đơn vị", name: "" },
    ],
    soTheoDoi: [
      { key: "nguoi_ghi", title: "Người ghi sổ", name: "" },
      { key: "chi_huy", title: "Chỉ huy đơn vị", name: "" },
    ],
  },
};

const MEALS = ["sang", "trua", "chieu"];

const SIGNATURE_BOOKS = Object.keys(DEFAULT_LEDGER_SETTINGS.signatures);

function slotText(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function mergeSignatures(partial) {
  const src = partial && typeof partial === "object" ? partial : {};
  const out = {};
  for (const book of SIGNATURE_BOOKS) {
    const defaults = DEFAULT_LEDGER_SETTINGS.signatures[book];
    const rows = Array.isArray(src[book]) ? src[book] : [];
    out[book] = defaults.map((slot) => {
      const hit = rows.find((row) => row && row.key === slot.key) || {};
      const title = hit.title == null ? slot.title : slotText(hit.title, 80);
      return {
        key: slot.key,
        title: title || slot.title,
        name: slotText(hit.name, 120),
      };
    });
  }
  return out;
}

function levelWithoutNorms(level) {
  return {
    code: level.code ?? "",
    dailyAmount: Number(level.dailyAmount),
    mealPrices: {
      sang: Number(level.mealPrices?.sang) || 0,
      trua: Number(level.mealPrices?.trua) || 0,
      chieu: Number(level.mealPrices?.chieu) || 0,
    },
  };
}

function mergeLedgerSettings(partial) {
  const src = partial && typeof partial === "object" ? partial : {};
  const levels = Array.isArray(src.levels) && src.levels.length
    ? src.levels.map(levelWithoutNorms)
    : DEFAULT_LEDGER_SETTINGS.levels.map(levelWithoutNorms);
  const threshold = Number(src.balanceWarnThreshold);
  return {
    spentBasis: src.spentBasis === "meal_out" ? "meal_out" : "total_out",
    balanceWarnThreshold: Number.isFinite(threshold) && threshold > 0
      ? threshold
      : DEFAULT_LEDGER_SETTINGS.balanceWarnThreshold,
    holidayLunchOnly: Boolean(src.holidayLunchOnly),
    riceNamePattern: String(src.riceNamePattern || DEFAULT_LEDGER_SETTINGS.riceNamePattern),
    levels,
    extraRates: { ...DEFAULT_LEDGER_SETTINGS.extraRates, ...(src.extraRates || {}) },
    signatures: mergeSignatures(src.signatures),
  };
}

function emptyHeadcount(settings) {
  const s = mergeLedgerSettings(settings);
  return {
    levels: s.levels.map((level) => ({
      code: level.code,
      dailyAmount: level.dailyAmount,
      sang: 0,
      trua: 0,
      chieu: 0,
    })),
    extras: { benhXa: 0, benhNhan: 0, omTrai: 0, leTet: 0 },
  };
}

function normalizeName(name) {
  return String(name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Khớp đầu tên: "tiêu" ăn "Tiêu bột", không ăn "Chuối tiêu". */
function nameMatchesRule(name, match) {
  const n = normalizeName(name);
  const m = normalizeName(match);
  if (!m) return false;
  return n === m || n.startsWith(m);
}

export {
  DEFAULT_LEDGER_SETTINGS,
  MEALS,
  SIGNATURE_BOOKS,
  mergeLedgerSettings,
  mergeSignatures,
  emptyHeadcount,
  normalizeName,
  nameMatchesRule,
};
