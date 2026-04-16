/** Đơn vị “đang làm việc” để gửi `X-Target-Unit-Id` — thu hẹp API xuống nhánh con (cấp trên xem cấp dưới). */
let targetUnitId = null;

export function getTargetUnitId() {
  return targetUnitId;
}

/** @param {number | string | null | undefined} id */
export function setTargetUnitId(id) {
  if (id == null || id === "") {
    targetUnitId = null;
    return;
  }
  const n = Number(id);
  targetUnitId = Number.isInteger(n) && n > 0 ? n : null;
}

export function clearTargetUnitId() {
  targetUnitId = null;
}

/** Gắn `unitId` vào body POST nếu chưa có (dữ liệu gắn đơn vị). */
export function withUnitId(body, unitId) {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }
  if (body.unitId != null) {
    return body;
  }
  const n = Number(unitId);
  if (!Number.isInteger(n) || n <= 0) {
    return body;
  }
  return { ...body, unitId: n };
}
