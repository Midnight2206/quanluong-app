/** Normalize commodity names for fuzzy matching (no Prisma). */

function normalizeCommodityName(name) {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} name
 * @param {{ id: number, name: string, code?: string|null }[]} commodities
 * @returns {{ commodityId: number|null, mapped: boolean, matchedName: string|null }}
 */
function mapCommodityNameToId(name, commodities) {
  const needle = normalizeCommodityName(name);
  if (!needle || !Array.isArray(commodities) || commodities.length === 0) {
    return { commodityId: null, mapped: false, matchedName: null };
  }

  for (const c of commodities) {
    if (normalizeCommodityName(c.name) === needle) {
      return { commodityId: Number(c.id), mapped: true, matchedName: c.name };
    }
  }

  for (const c of commodities) {
    if (c.code != null && normalizeCommodityName(c.code) === needle) {
      return { commodityId: Number(c.id), mapped: true, matchedName: c.name };
    }
  }

  const includesHits = commodities.filter((c) => {
    const n = normalizeCommodityName(c.name);
    return n.includes(needle) || needle.includes(n);
  });
  if (includesHits.length === 1) {
    const c = includesHits[0];
    return { commodityId: Number(c.id), mapped: true, matchedName: c.name };
  }

  return { commodityId: null, mapped: false, matchedName: null };
}

export { normalizeCommodityName, mapCommodityNameToId };
