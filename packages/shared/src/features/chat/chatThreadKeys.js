/** @param {string} key */
export function parseChatThreadKey(key) {
  if (typeof key !== "string") {
    return null;
  }
  const idx = key.indexOf(":");
  if (idx === -1) {
    return null;
  }
  const prefix = key.slice(0, idx);
  const id = Number(key.slice(idx + 1));
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }
  if (prefix === "d") {
    return { type: "direct", id };
  }
  if (prefix === "g") {
    return { type: "group", id };
  }
  return null;
}

/** @param {'direct'|'group'} type @param {number} id */
export function chatThreadKey(type, id) {
  return type === "direct" ? `d:${id}` : `g:${id}`;
}
