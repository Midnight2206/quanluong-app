export function supplierCreateBlockReason({
  isSupplierCreateType,
  catalogFailed = false,
  supplierIds,
  username,
  email,
  password,
  fullName,
  typeId,
}) {
  if (
    !username.trim() ||
    !email.trim() ||
    password.length < 8 ||
    !fullName.trim() ||
    !typeId
  ) {
    return "Điền đủ: username, email, mật khẩu (≥8), họ tên, vai trò.";
  }
  if (isSupplierCreateType && catalogFailed) {
    return "Không tải được danh sách nhà cung cấp.";
  }
  if (isSupplierCreateType && supplierIds.length === 0) {
    return "Chọn ít nhất một nhà cung cấp.";
  }
  return null;
}

export function supplierCreateBody({
  isSupplierCreateType,
  supplierIds,
  unitId,
  username,
  email,
  password,
  fullName,
  typeId,
}) {
  return {
    username: username.trim(),
    email: email.trim(),
    password,
    typeId: Number(typeId),
    unitId: isSupplierCreateType ? null : unitId ? Number(unitId) : null,
    ...(isSupplierCreateType ? { supplierIds } : {}),
    profile: { fullName: fullName.trim() },
  };
}

export function supplierIdsFromLinks(data) {
  return Array.isArray(data?.links)
    ? data.links
      .map((link) => Number(link?.supplierId))
      .filter((id) => Number.isFinite(id))
    : [];
}

export function supplierEditBlockReason(supplierIds) {
  if (supplierIds.length === 0) {
    return "Chọn ít nhất một nhà cung cấp.";
  }
  return null;
}

export function supplierEditPatch(userId, supplierIds) {
  return { id: userId, supplierIds };
}
