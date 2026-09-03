import { describe, it, expect, vi } from "vitest";

const mockPrisma = {
  lttpUnitIssueFormDefaults: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
};

vi.mock("../../infra/database/prisma/prisma.client.js", () => ({ prisma: mockPrisma }));

const { SIGNATURE_CATALOG, getCatalogNodesForCategory } = await import(
  "./chung-tu-signature-catalog.js"
);

describe("SIGNATURE_CATALOG", () => {
  it("bkmh.nguoiMua resolves name from buyer profile", async () => {
    mockPrisma.lttpUnitIssueFormDefaults.findUnique.mockResolvedValue({
      defaultBuyerUser: {
        profile: { fullName: "Nguyễn Văn A", rankAbbr: "Th/tá", department: "Tài vụ" },
      },
    });
    const result = await SIGNATURE_CATALOG["bkmh.nguoiMua"].resolve({
      storageUnitId: 1,
      prisma: mockPrisma,
    });
    expect(result).toEqual({ name: "Th/tá Nguyễn Văn A", title: "Tài vụ" });
  });

  it("bkmh.nguoiMua returns null if no buyer user", async () => {
    mockPrisma.lttpUnitIssueFormDefaults.findUnique.mockResolvedValue(null);
    const result = await SIGNATURE_CATALOG["bkmh.nguoiMua"].resolve({
      storageUnitId: 1,
      prisma: mockPrisma,
    });
    expect(result).toBeNull();
  });

  it("profile.currentUser resolves from current user profile", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      profile: { fullName: "Trần Thị B", rankAbbr: "Đ/tá", department: "Hành chính" },
    });
    const result = await SIGNATURE_CATALOG["profile.currentUser"].resolve({
      currentUserId: 5,
      prisma: mockPrisma,
    });
    expect(result).toEqual({ name: "Đ/tá Trần Thị B", title: "Hành chính" });
  });

  it("getCatalogNodesForCategory filters by applicableTo", () => {
    const nodes = getCatalogNodesForCategory("bang-ke-mua-hang");
    expect(nodes.some((n) => n.id === "bkmh.nguoiMua")).toBe(true);
    expect(nodes.some((n) => n.id === "profile.currentUser")).toBe(true);
  });

  it("getCatalogNodesForCategory returns currentUser for non-bkmh", () => {
    const nodes = getCatalogNodesForCategory("phieu-xuat-kho");
    expect(nodes.some((n) => n.id === "bkmh.nguoiMua")).toBe(false);
    expect(nodes.some((n) => n.id === "profile.currentUser")).toBe(true);
  });
});
