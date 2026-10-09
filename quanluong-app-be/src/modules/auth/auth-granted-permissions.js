/**
 * Có chức danh thì gói quyền của chức danh là quyền hiệu lực.
 * Không chức danh thì dùng quyền của loại tài khoản (admin).
 * Superadmin giữ quyền loại tài khoản; middleware và UI vẫn mở toàn bộ.
 */
function grantedPermissionRecords(user, typePerms, jobPerms) {
  const lockedToJobTitle =
    user?.type?.name !== "superadmin" && user?.jobTitleId != null;
  return lockedToJobTitle ? jobPerms || [] : typePerms || [];
}

export { grantedPermissionRecords };
