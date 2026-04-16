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
    priceTables: (unitId, from, to) => ["lttp", "priceTables", String(unitId), from ?? "", to ?? ""],
    effectivePrices: (unitId, date) => ["lttp", "effectivePrices", String(unitId), date ?? ""],
    priceTableDetail: (id) => ["lttp", "priceTableDetail", String(id)],
  },
  mealRoster: {
    root: ["mealRoster"],
    list: (unitId, yearMonth) => ["mealRoster", "list", String(unitId), String(yearMonth)],
    meta: (unitId, yearMonth) => ["mealRoster", "meta", String(unitId), String(yearMonth ?? "none")],
    catalog: () => ["mealRoster", "catalog"],
    dayMarks: (unitId, yearMonth) => ["mealRoster", "dayMarks", String(unitId), String(yearMonth)],
  },
};

/** Các tag string RTK `invalidateTags([...])` → prefix queryKey để invalidate. */
export const RTK_TAG_INVALIDATION_MAP = {
  User: qk.users.root,
  JobTitle: qk.jobTitles.root,
  Registration: qk.registrations.root,
  LttpCommodity: qk.lttp.root,
  LttpPrice: qk.lttp.root,
  LttpFoodGroup: qk.lttp.root,
  Unit: qk.units.root,
  UnitLevelCaps: qk.unitLevelCaps.root,
  Type: qk.types.root,
  PermissionCatalog: qk.permissions.root,
  UnitPrivateShare: qk.units.root,
  MealAllowanceRate: qk.mealAllowanceRates.root,
  MealRoster: qk.mealRoster.root,
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
