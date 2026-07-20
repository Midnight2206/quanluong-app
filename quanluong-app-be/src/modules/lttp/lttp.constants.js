const LTTP_MODULE_NAME = "lttp";

const LTTP_PERMISSIONS = {
  COMMODITIES_READ: "lttp.commodities.read",
  COMMODITIES_WRITE: "lttp.commodities.write",
  PRICES_READ: "lttp.prices.read",
  PRICES_WRITE: "lttp.prices.write",
  GROUPS_READ: "lttp.groups.read",
  GROUPS_MANAGE: "lttp.groups.manage",
  ISSUE_SLIPS_READ: "lttp.issue-slips.read",
  ISSUE_SLIPS_WRITE: "lttp.issue-slips.write",
};

const LTTP_OTHER_GROUP_CODE = "other";

/** Nguồn giá dòng phiếu xuất LTTP. */
const LTTP_ISSUE_SLIP_PRICE_KIND = Object.freeze({
  MARKET: "market",
  TGSX: "tgsx",
});

export { LTTP_ISSUE_SLIP_PRICE_KIND, LTTP_MODULE_NAME, LTTP_OTHER_GROUP_CODE, LTTP_PERMISSIONS };
