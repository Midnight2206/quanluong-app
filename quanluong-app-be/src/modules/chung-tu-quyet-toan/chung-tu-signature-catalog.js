import { prisma as defaultPrisma } from "../../infra/database/prisma/prisma.client.js";

export const SIGNATURE_CATALOG = {
  "bkmh.nguoiMua": {
    label: "Người mua (BKMH)",
    applicableTo: ["bang-ke-mua-hang"],
    resolve: async ({ storageUnitId, prisma = defaultPrisma } = {}) => {
      const defaults = await prisma.lttpUnitIssueFormDefaults.findUnique({
        where: { unitId: Number(storageUnitId) },
        include: {
          defaultBuyerUser: {
            select: {
              profile: { select: { fullName: true, rankAbbr: true, department: true } },
            },
          },
        },
      });
      const profile = defaults?.defaultBuyerUser?.profile;
      if (!profile?.fullName) return null;
      const name = [profile.rankAbbr, profile.fullName].filter(Boolean).join(" ");
      return { name, title: profile.department ?? null };
    },
  },

  "profile.currentUser": {
    label: "Người dùng hiện tại",
    applicableTo: ["*"],
    resolve: async ({ currentUserId, prisma = defaultPrisma } = {}) => {
      const user = await prisma.user.findUnique({
        where: { id: Number(currentUserId) },
        select: {
          profile: { select: { fullName: true, rankAbbr: true, department: true } },
        },
      });
      const profile = user?.profile;
      if (!profile?.fullName) return null;
      const name = [profile.rankAbbr, profile.fullName].filter(Boolean).join(" ");
      return { name, title: profile.department ?? null };
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
