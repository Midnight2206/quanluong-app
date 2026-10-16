/** Chỉ phiên superadmin (phạm vi toàn hệ thống) được gán loại superadmin. */
function superadminTypeAssignError(typeName, scopeMode) {
  if (typeName === "superadmin" && scopeMode !== "all") {
    return "Chỉ superadmin được gán loại tài khoản superadmin.";
  }
  return null;
}

function softDeleteActorError({ actorId, targetId, targetTypeName, scopeMode }) {
  if (actorId != null && Number(actorId) === Number(targetId)) {
    return "Không xóa tài khoản đang đăng nhập.";
  }
  if (targetTypeName === "superadmin" && scopeMode !== "all") {
    return "Chỉ superadmin được xóa tài khoản superadmin.";
  }
  return null;
}

export { softDeleteActorError, superadminTypeAssignError };
