import { prisma as defaultPrisma } from "../../infra/database/prisma/prisma.client.js";

const BUYER_PROFILE_SELECT = {
  select: {
    username: true,
    profile: { select: { fullName: true, rankAbbr: true, department: true } },
  },
};

export function formatSystemPersonName(user) {
  if (!user) return null;
  const profile = user.profile ?? {};
  const fullName = String(profile.fullName ?? "").trim();
  const username = String(user.username ?? "").trim();
  const name = fullName || username;
  if (!name) return null;
  const rankAbbr = String(profile.rankAbbr ?? "").trim();
  const signatureName = [rankAbbr, name].filter(Boolean).join(" ");
  const title = String(profile.department ?? "").trim() || null;
  // name = header (không cấp bậc); signatureName = khung ký (rankAbbr + tên)
  return { name, signatureName, title };
}

export const SIGNATURE_CATALOG = {
  "bkmh.nguoiMua": {
    label: "Người mua (BKMH)",
    applicableTo: ["bang-ke-mua-hang"],
    resolve: async ({ storageUnitId, prisma = defaultPrisma } = {}) => {
      const unitId = Number(storageUnitId);
      if (!Number.isInteger(unitId) || unitId <= 0) return null;
      const defaults = await prisma.lttpUnitIssueFormDefaults.findUnique({
        where: { unitId },
        include: { defaultBuyerUser: BUYER_PROFILE_SELECT },
      });
      return formatSystemPersonName(defaults?.defaultBuyerUser);
    },
  },

  "profile.currentUser": {
    label: "Người dùng hiện tại",
    applicableTo: ["*"],
    resolve: async ({ currentUserId, prisma = defaultPrisma } = {}) => {
      const userId = Number(currentUserId);
      if (!Number.isInteger(userId) || userId <= 0) return null;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        ...BUYER_PROFILE_SELECT,
      });
      return formatSystemPersonName(user);
    },
  },
};

/**
 * Trả danh sách catalog nodes áp dụng cho loại chứng từ.
 * @param {string} categoryKey
 * @returns {{ id: string, label: string }[]}
 */
export function getCatalogNodesForCategory(categoryKey) {
  return Object.entries(SIGNATURE_CATALOG)
    .filter(([, node]) => node.applicableTo.includes("*") || node.applicableTo.includes(categoryKey))
    .map(([id, node]) => ({ id, label: node.label }));
}
