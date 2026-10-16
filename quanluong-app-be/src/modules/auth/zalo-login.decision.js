function decideZaloOauth(user) {
  if (!user || user.deletedAt) {
    return { kind: "await_phone" };
  }
  if (user.typeName === "superadmin") {
    return { kind: "error", code: "superadmin" };
  }
  if (user.registrationStatus === "PENDING_APPROVAL") {
    return { kind: "pending", userId: user.id };
  }
  if (user.registrationStatus !== "APPROVED" || !user.isActive) {
    return { kind: "error", code: "inactive" };
  }
  // Trình duyệt đã đăng nhập Zalo sẽ trả mã ngay. Vào app chỉ sau khi xác minh số lại.
  return { kind: "await_phone" };
}

function decideZaloPhone({ matches, zaloUserId }) {
  const rows = (matches ?? []).filter((row) => !row.deletedAt);
  const hasSuperadmin = rows.some((row) => row.typeName === "superadmin");
  if (hasSuperadmin) {
    if (rows.length === 1) {
      return { kind: "error", code: "superadmin" };
    }
    return { kind: "error", code: "ambiguous" };
  }
  if (rows.length > 1) {
    return { kind: "error", code: "ambiguous" };
  }
  if (rows.length === 1 && rows[0].registrationStatus === "PENDING_APPROVAL") {
    return { kind: "pending", userId: rows[0].id };
  }
  if (
    rows.length === 1 &&
    rows[0].registrationStatus === "APPROVED" &&
    rows[0].isActive &&
    !rows[0].zaloUserId
  ) {
    return { kind: "password", userId: rows[0].id };
  }
  if (
    rows.length === 1 &&
    rows[0].registrationStatus === "APPROVED" &&
    rows[0].isActive &&
    zaloUserId &&
    rows[0].zaloUserId === zaloUserId
  ) {
    return { kind: "session", userId: rows[0].id };
  }
  if (rows.length === 1) {
    return { kind: "error", code: "inactive" };
  }
  return { kind: "register" };
}

export { decideZaloOauth, decideZaloPhone };
