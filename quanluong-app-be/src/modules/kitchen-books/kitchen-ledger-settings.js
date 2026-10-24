/**
 * Mặc định theo bếp tiểu đoàn (bộ chung). Bếp khác ghi đè theo đơn vị
 * (ví dụ ĐD5: ngưỡng 10.000, lễ tết chỉ trưa, sữa theo ngày bay).
 * XĐ-2: tiền đã sử dụng mặc định Σ Cộng xuất (ΣS), đúng sổ đang làm.
 */
const DEFAULT_LEDGER_SETTINGS = {
  spentBasis: "total_out",
  balanceWarnThreshold: 20000,
  holidayLunchOnly: false,
  riceSettlementPrice: 16000,
  fuelPerServing: 2200,
  servingWeights: { sang: 0.2, trua: 0.4, chieu: 0.4 },
  riceNamePattern: "gạo",
  riceManualOnGuarantee: true,
  requireIssueSlip: true,
  requirePriceTable: true,
  milk: {
    mode: "patient_plus_levels",
    boxesPerPerson: 1,
    fromPatientExtra: true,
    levelDailyAmounts: [130000],
  },
  spices: [
    { match: "dầu ăn", peoplePerUnit: 25, qtyPerUnit: 1, roundStep: 0.1 },
    { match: "nước mắm", peoplePerUnit: 20, qtyPerUnit: 1, roundStep: 0.1 },
    { match: "muối", peoplePerUnit: 80, qtyPerUnit: 1, roundStep: 0.1 },
    { match: "mỳ chính", peoplePerUnit: 250, qtyPerUnit: 1, roundStep: 0.1 },
    { match: "mì chính", peoplePerUnit: 250, qtyPerUnit: 1, roundStep: 0.1 },
    { match: "tiêu", peoplePerUnit: 40, qtyPerUnit: 0.1, roundStep: 0.1 },
    { match: "ớt bột", peoplePerUnit: 40, qtyPerUnit: 0.1, roundStep: 0.1 },
    { match: "đường", peoplePerUnit: 200, qtyPerUnit: 1, roundStep: 0.1 },
    { match: "hành khô", fixedQty: 0.4 },
    { match: "tỏi khô", fixedQty: 0.4 },
  ],
  levels: [
    {
      code: "72",
      dailyAmount: 72000,
      mealPrices: { sang: 14400, trua: 28800, chieu: 28800 },
      riceGrams: { sang: 140, trua: 270, chieu: 270 },
    },
    {
      code: "130",
      dailyAmount: 130000,
      mealPrices: { sang: 14400, trua: 86800, chieu: 28800 },
      riceGrams: { sang: 140, trua: 280, chieu: 280 },
    },
  ],
  extraRates: { benhXa: 14400, benhNhan: 54000, omTrai: 20000, leTet: 108000 },
  balanceRound: {
    defaultStep: 1,
    fuelStep: 100000,
    steps: [
      { match: "dầu", step: 1 },
      { match: "mắm", step: 1 },
      { match: "muối", step: 1 },
      { match: "mỳ chính", step: 1 },
      { match: "mì chính", step: 1 },
      { match: "đường", step: 1 },
      { match: "tiêu", step: 0.5 },
      { match: "ớt", step: 0.5 },
      { match: "hành", step: 0.5 },
      { match: "tỏi", step: 0.5 },
    ],
  },
};

const MEALS = ["sang", "trua", "chieu"];

function mergeLedgerSettings(partial) {
  const src = partial && typeof partial === "object" ? partial : {};
  return {
    ...DEFAULT_LEDGER_SETTINGS,
    ...src,
    servingWeights: { ...DEFAULT_LEDGER_SETTINGS.servingWeights, ...(src.servingWeights || {}) },
    milk: { ...DEFAULT_LEDGER_SETTINGS.milk, ...(src.milk || {}) },
    extraRates: { ...DEFAULT_LEDGER_SETTINGS.extraRates, ...(src.extraRates || {}) },
    balanceRound: {
      ...DEFAULT_LEDGER_SETTINGS.balanceRound,
      ...(src.balanceRound || {}),
      steps: src.balanceRound?.steps ?? DEFAULT_LEDGER_SETTINGS.balanceRound.steps,
    },
    spices: src.spices ?? DEFAULT_LEDGER_SETTINGS.spices,
    levels: src.levels ?? DEFAULT_LEDGER_SETTINGS.levels,
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
  mergeLedgerSettings,
  emptyHeadcount,
  normalizeName,
  nameMatchesRule,
};
