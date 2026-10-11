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
  return { kind: "session", userId: user.id };
}

function decideZaloPhone({ matches }) {
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
  if (rows.length === 1) {
    return { kind: "error", code: "inactive" };
  }
  return { kind: "register" };
}

export { decideZaloOauth, decideZaloPhone };
