/** Prefix queryKey theo domain — dùng cho invalidate sau mutation. */

export const qk = {
  auth: {
    root: ["auth"],
    currentUser: () => ["auth", "currentUser"],
    registerUnits: () => ["auth", "registerUnits"],
    avatarJob: (jobId) => ["auth", "avatarJob", String(jobId)],
  },
  users: { root: ["users"], list: () => ["users", "list"] },
  types: { root: ["types"], list: () => ["types", "list"] },
  units: {
    root: ["units"],
    list: () => ["units", "list"],
    scopeFlat: () => ["units", "scopeFlat"],
    privateShares: (ownerUnitId) => ["units", "privateShares", String(ownerUnitId)],
  },
  jobTitles: { root: ["jobTitles"], list: () => ["jobTitles", "list"], detail: (id) => ["jobTitles", id] },
  registrations: { root: ["registrations"], pending: () => ["registrations", "pending"] },
  permissions: { root: ["permissions"], catalog: () => ["permissions", "catalog"] },
  unitLevelCaps: { root: ["unitLevelCaps"], matrix: () => ["unitLevelCaps", "matrix"] },
  mealAllowanceRates: { root: ["mealAllowanceRates"], list: () => ["mealAllowanceRates", "list"] },
  lttp: {
    root: ["lttp"],
    foodGroups: () => ["lttp", "foodGroups"],
    foodGroupsCatalog: () => ["lttp", "foodGroupsCatalog"],
    commodities: (unitId) => ["lttp", "commodities", String(unitId)],
    suppliers: (unitId) => ["lttp", "suppliers", String(unitId)],
    priceTables: (unitId, from, to) => ["lttp", "priceTables", String(unitId), from ?? "", to ?? ""],
    effectivePrices: (unitId, date) => ["lttp", "effectivePrices", String(unitId), date ?? ""],
    priceTableDetail: (id) => ["lttp", "priceTableDetail", String(id)],
    issueSlips: (unitId, from, to, recipientUnitId, page, pageSize) => [
      "lttp",
      "issueSlips",
      String(unitId),
      from ?? "",
      to ?? "",
      recipientUnitId != null && recipientUnitId !== "" ? String(recipientUnitId) : "",
      String(page ?? 1),
      String(pageSize ?? 20),
    ],
    issueFormDefaults: (unitId) => ["lttp", "issueFormDefaults", String(unitId)],
    nextIssueSlipSerial: (unitId, date) => ["lttp", "nextIssueSlipSerial", String(unitId), date ?? ""],
    recipientUsers: (unitId) => ["lttp", "recipientUsers", String(unitId)],
    receivingDefaultRecipient: (recipientUnitId) => [
      "lttp",
      "receivingDefaultRecipient",
      String(recipientUnitId ?? ""),
    ],
    receivingDefaultRecipientsList: () => ["lttp", "receivingDefaultRecipientsList"],
    buyerDefaultsList: () => ["lttp", "buyerDefaultsList"],
    buyerUsers: (unitId) => ["lttp", "buyerUsers", String(unitId)],
    dailyOrderSummary: (unitId, date, supplierFilter) => [
      "lttp",
      "dailyOrderSummary",
      String(unitId ?? ""),
      date ?? "",
      supplierFilter ?? "all",
    ],
  },
  mealRoster: {
    root: ["mealRoster"],
    list: (unitId, yearMonth) => ["mealRoster", "list", String(unitId), String(yearMonth)],
    meta: (unitId, yearMonth) => ["mealRoster", "meta", String(unitId), String(yearMonth ?? "none")],
    catalog: () => ["mealRoster", "catalog"],
    dayMarks: (unitId, yearMonth) => ["mealRoster", "dayMarks", String(unitId), String(yearMonth)],
  },
  kitchenBooks: {
    root: ["kitchenBooks"],
    catalog: (unitId, q) => ["kitchenBooks", "catalog", String(unitId), q ?? ""],
    catalogDetail: (unitId, id) => ["kitchenBooks", "catalogDetail", String(unitId), String(id)],
    menu: (unitId, date) => ["kitchenBooks", "menu", String(unitId), String(date)],
    monthMarkers: (unitId, yearMonth) => [
      "kitchenBooks",
      "monthMarkers",
      String(unitId),
      String(yearMonth),
    ],
    receiptSlips: (unitId, date) => [
      "kitchenBooks",
      "receiptSlips",
      String(unitId),
      date ?? "",
    ],
    receiptSlipByDay: (unitId, date) => [
      "kitchenBooks",
      "receiptSlipByDay",
      String(unitId),
      String(date),
    ],
    receiptSlip: (id) => ["kitchenBooks", "receiptSlip", String(id)],
    receiptSlipSerial: (unitId, date) => [
      "kitchenBooks",
      "receiptSlipSerial",
      String(unitId),
      String(date),
    ],
    receiptGuaranteeFromIssue: (unitId, date) => [
      "kitchenBooks",
      "receiptGuaranteeFromIssue",
      String(unitId),
      String(date),
    ],
  },
  chungTuQuyetToan: {
    root: ["chungTuQuyetToan"],
    templateCatalog: (categoryKey) => [
      "chungTuQuyetToan",
      "templateCatalog",
      categoryKey != null && String(categoryKey).trim() ? String(categoryKey).trim() : "_all",
    ],
    templateTree: (folderId, categoryKey) => [
      "chungTuQuyetToan",
      "templateTree",
      String(folderId ?? "root"),
      String(categoryKey ?? ""),
    ],
    categoryTemplates: (categoryKey) => ["chungTuQuyetToan", "categoryTemplates", String(categoryKey)],
    templateFillMapping: (categoryKey, driveFileId) => [
      "chungTuQuyetToan",
      "templateFillMapping",
      String(categoryKey),
      String(driveFileId),
    ],
    unitProfile: (unitId) => ["chungTuQuyetToan", "unitProfile", String(unitId)],
    documents: (unitId, categoryKey) => [
      "chungTuQuyetToan",
      "documents",
      String(unitId),
      categoryKey != null && String(categoryKey).trim() ? String(categoryKey).trim() : "_all",
    ],
    document: (documentKey) => ["chungTuQuyetToan", "document", String(documentKey)],
  },
};

/** Các tag string RTK `invalidateTags([...])` → prefix queryKey để invalidate. */
export const RTK_TAG_INVALIDATION_MAP = {
  User: qk.users.root,
  JobTitle: qk.jobTitles.root,
  Registration: qk.registrations.root,
  LttpCommodity: qk.lttp.root,
  LttpSupplier: qk.lttp.root,
  LttpPrice: qk.lttp.root,
  LttpFoodGroup: qk.lttp.root,
  Unit: qk.units.root,
  UnitLevelCaps: qk.unitLevelCaps.root,
  Type: qk.types.root,
  PermissionCatalog: qk.permissions.root,
  UnitPrivateShare: qk.units.root,
  MealAllowanceRate: qk.mealAllowanceRates.root,
  MealRoster: qk.mealRoster.root,
  KitchenBooks: qk.kitchenBooks.root,
  Auth: qk.auth.root,
};

export function invalidateRtkTagTypes(queryClient, tagTypes) {
  for (const t of tagTypes) {
    const prefix = RTK_TAG_INVALIDATION_MAP[t];
    if (prefix) {
      queryClient.invalidateQueries({ queryKey: prefix });
    }
  }
}
