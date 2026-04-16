/**
 * @param {{ requireAll?: string[]; requireAny?: string[] }} def
 * @param {string[]} permissionCodes
 */
export function meetsPermissionGates(def, permissionCodes) {
  if (!def?.requireAll?.length && !def?.requireAny?.length) {
    return true;
  }
  const has = (code) => permissionCodes.includes(code);
  if (def.requireAll?.length && !def.requireAll.every(has)) {
    return false;
  }
  if (def.requireAny?.length && !def.requireAny.some(has)) {
    return false;
  }
  return true;
}
