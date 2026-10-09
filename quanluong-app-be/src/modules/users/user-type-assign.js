/** Chỉ phiên superadmin (phạm vi toàn hệ thống) được gán loại superadmin. */
function superadminTypeAssignError(typeName, scopeMode) {
  if (typeName === "superadmin" && scopeMode !== "all") {
    return "Chỉ superadmin được gán loại tài khoản superadmin.";
  }
  return null;
}

export { superadminTypeAssignError };
