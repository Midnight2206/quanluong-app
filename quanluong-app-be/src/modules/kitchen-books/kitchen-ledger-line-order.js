/**
 * Thứ tự dòng sổ theo nhóm LTTP.
 * sortOrder trên LttpFoodGroup thắng. sortOrder = 0 thì dùng thứ tự mã bên dưới
 * (cùng số với migration 20261026140000). Mã lạ đứng ngay trước chat_dot.
 * Đổi thứ tự sau này bằng cách sửa sortOrder trong bảng, không sửa file này.
 */
const GROUP_RANK = {
  gao: 10,
  thit_nac: 20,
  thit_xo_loc: 30,
  bo: 40,
  gia_cam: 50,
  ca: 60,
  trung: 70,
  dau_phu: 80,
  vung_lac: 90,
  rau: 100,
  hoa_qua: 110,
  sua: 120,
  nuoc_mam: 130,
  muoi: 140,
  mi_chinh: 150,
  dau_mo: 160,
  gia_vi: 170,
  other: 180,
  chat_dot: 200,
  ve_sinh: 210,
};

const UNKNOWN_RANK = 190;

function hasGroupMeta(line) {
  return Boolean(line?.groupCode) || (Number.isFinite(line?.groupSort) && line.groupSort !== 0);
}

function groupRank(line) {
  if (Number.isFinite(line?.groupSort) && line.groupSort !== 0) return line.groupSort;
  if (line?.groupCode && GROUP_RANK[line.groupCode] != null) return GROUP_RANK[line.groupCode];
  if (line?.groupCode) return UNKNOWN_RANK;
  if (line?.role === "rice") return GROUP_RANK.gao;
  if (line?.role === "fuel") return GROUP_RANK.chat_dot;
  return UNKNOWN_RANK;
}

function roleRank(role) {
  if (role === "rice") return 0;
  if (role === "spice") return 2;
  if (role === "fuel") return 3;
  return 1;
}

function byName(a, b) {
  return String(a.name || "").localeCompare(String(b.name || ""), "vi");
}

function byPrice(a, b) {
  const pa = Number(a.unitPrice);
  const pb = Number(b.unitPrice);
  if (pa === pb) return 0;
  if (!Number.isFinite(pa)) return 1;
  if (!Number.isFinite(pb)) return -1;
  return pa < pb ? -1 : 1;
}

function byDate(a, b) {
  if (a.receivedDate === b.receivedDate) return 0;
  return String(a.receivedDate || "") < String(b.receivedDate || "") ? -1 : 1;
}

function compareGrouped(a, b) {
  const rank = groupRank(a) - groupRank(b);
  if (rank) return rank;
  const name = byName(a, b);
  if (name) return name;
  const date = byDate(a, b);
  if (date) return date;
  return byPrice(a, b);
}

function compareLegacy(a, b) {
  const rank = roleRank(a.role) - roleRank(b.role);
  if (rank) return rank;
  if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
  const date = byDate(a, b);
  if (date) return date;
  return byPrice(a, b);
}

function sortLedgerLines(lines) {
  const rows = [...(lines || [])];
  const grouped = rows.some(hasGroupMeta);
  rows.sort(grouped ? compareGrouped : compareLegacy);
  return rows;
}

export {
  GROUP_RANK,
  UNKNOWN_RANK,
  groupRank,
  hasGroupMeta,
  sortLedgerLines,
};
