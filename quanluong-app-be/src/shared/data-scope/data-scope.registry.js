/**
 * Quy định loại dữ liệu theo phạm vi: public (toàn hệ thống) hoặc private (theo đơn vị / chính sách kế thừa).
 * Mã `code` dùng trong grant và middleware.
 */
export const DATA_SCOPE_KINDS = {
  LTTP_FOOD_GROUP: {
    code: "LTTP_FOOD_GROUP",
    visibility: "public",
    prismaModel: "LttpFoodGroup",
  },
  LTTP_COMMODITY: {
    code: "LTTP_COMMODITY",
    visibility: "private",
    prismaModel: "LttpCommodity",
    unitField: "unitId",
  },
  LTTP_PRICE_TABLE: {
    code: "LTTP_PRICE_TABLE",
    visibility: "private",
    prismaModel: "LttpPriceTable",
    unitField: "unitId",
  },
  JOB_TITLE: {
    code: "JOB_TITLE",
    visibility: "private",
    prismaModel: "JobTitle",
    unitField: "unitId",
  },
};

/** @param {string} code */
export function getDataKindDefinition(code) {
  return DATA_SCOPE_KINDS[code] ?? null;
}

export function listPrivateDataKindCodes() {
  return Object.values(DATA_SCOPE_KINDS)
    .filter((k) => k.visibility === "private")
    .map((k) => k.code);
}
