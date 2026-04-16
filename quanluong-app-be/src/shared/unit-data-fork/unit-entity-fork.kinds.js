/**
 * Đồng bộ với `UnitEntityForkKind` trong Prisma.
 * Thêm nghiệp vụ «đẩy xuống đơn vị con» cho LTTP: dùng cùng bảng `UnitEntityFork` + unique (kind, sourceRecordId, targetUnitId).
 */
const UNIT_ENTITY_FORK_KIND = {
  JOB_TITLE: "JOB_TITLE",
  LTTP_COMMODITY: "LTTP_COMMODITY",
  LTTP_PRICE_TABLE: "LTTP_PRICE_TABLE",
};

export { UNIT_ENTITY_FORK_KIND };
