function normalizeBuyerName(name) {
  return String(name ?? "")
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function toPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function buildBkmhBuyerKey({ buyerUserId, buyerName }) {
  const uid = toPositiveInt(buyerUserId);
  if (uid != null) return `user:${uid}`;
  const normalized = normalizeBuyerName(buyerName);
  if (normalized) return `name:${normalized}`;
  return "";
}

function buildBkmhBuyerSnapshotFromPerson(person, buyerUserId = null) {
  const uid = toPositiveInt(buyerUserId);
  const buyerName = person?.name ? String(person.name).trim() : "";
  return {
    buyerUserId: uid,
    buyerKey: buildBkmhBuyerKey({ buyerUserId: uid, buyerName }),
    buyerName,
    buyerSignatureName: person?.signatureName ? String(person.signatureName).trim() : "",
    buyerTitle: person?.title ? String(person.title).trim() : "",
  };
}

export { buildBkmhBuyerKey, buildBkmhBuyerSnapshotFromPerson, normalizeBuyerName };
