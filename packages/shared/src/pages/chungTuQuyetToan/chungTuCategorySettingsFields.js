/** App chỉ fill số chứng từ; ngày tháng năm và tổng tiền bằng chữ tự tính từ backend. */
export const CHUNG_TU_APP_SETTINGS_FIELDS = [
  { key: "soChungTu", label: "Số chứng từ" },
];

export function getChungTuCategorySettingsFields() {
  return CHUNG_TU_APP_SETTINGS_FIELDS;
}

export function getChungTuCategoryProfilePersistKeys() {
  return [];
}
