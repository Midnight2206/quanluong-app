import { meetsPermissionGates } from "@/features/ui/meetsPermissionGates";

/**
 * Lọc tab dashboard theo mảng mã quyền từ BE (JWT / current-user).
 *
 * Mỗi định nghĩa tab có thể thêm:
 * - `requireAll?: string[]` — cần đủ mọi mã
 * - `requireAny?: string[]` — cần ít nhất một mã
 * Không khai báo gì → luôn hiển thị.
 *
 * @template T
 * @param {Array<T & { requireAll?: string[]; requireAny?: string[] }>} tabDefs
 * @param {string[]} permissionCodes
 * @returns {Array<Pick<T, keyof T>>}
 */
export function filterTabsByPermissions(tabDefs, permissionCodes) {
  return tabDefs
    .filter((def) => meetsPermissionGates(def, permissionCodes))
    .map(({ requireAll: _a, requireAny: _b, ...tab }) => tab);
}
