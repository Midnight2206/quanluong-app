/** Nhãn tiếng Việt cho `permission.module` — dùng trong ma trận quyền và modal phân quyền. */
const PERMISSION_MODULE_LABELS_VI = {
  kitchenBooks: "Sổ sách bếp ăn",
  mealRoster: "Chấm cơm",
  mealAllowanceRates: "Mức tiền ăn",
  lttp: "LTTP",
  ChungTuQuyetToan: "Chứng từ quyết toán",
  jobTitles: "Chức danh",
  users: "Người dùng",
  units: "Đơn vị",
  registrations: "Đăng ký",
  permissions: "Danh mục quyền",
  unitLevel: "Cấp đơn vị",
  unitLevelCaps: "Trần quyền theo cấp",
  other: "Khác",
};

function formatPermissionModuleLabel(moduleKey) {
  if (!moduleKey) {
    return PERMISSION_MODULE_LABELS_VI.other;
  }
  return PERMISSION_MODULE_LABELS_VI[moduleKey] ?? moduleKey;
}

export { PERMISSION_MODULE_LABELS_VI, formatPermissionModuleLabel };
