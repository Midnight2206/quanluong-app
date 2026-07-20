import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { pickLevel1IdFromChain } from "./unit-level.pure.js";

export { pickLevel1IdFromChain };

async function loadSelfToRoot(unitId) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { id: true, depth: true, parentId: true, path: true },
  });
  if (!unit) {
    throw new AppError({
      message: "Unit was not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  const ids = (unit.path || "")
    .split("/")
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

  if (ids.length) {
    const rows = await prisma.unit.findMany({
      where: { id: { in: ids } },
      select: { id: true, depth: true, parentId: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return [...ids].reverse().map((id) => byId.get(id)).filter(Boolean);
  }

  const chain = [];
  let cur = unit;
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.push({ id: cur.id, depth: cur.depth, parentId: cur.parentId });
    if (cur.parentId == null) {
      break;
    }
    cur = await prisma.unit.findUnique({
      where: { id: cur.parentId },
      select: { id: true, depth: true, parentId: true },
    });
  }
  return chain;
}

export async function getLevel1UnitId(unitId) {
  const chain = await loadSelfToRoot(unitId);
  return pickLevel1IdFromChain(chain);
}

export async function assertLogicalUnitIsLevel1ForWrite(logicalUnitId) {
  const unit = await prisma.unit.findUnique({
    where: { id: logicalUnitId },
    select: { id: true, depth: true },
  });
  if (!unit) {
    throw new AppError({
      message: "Unit was not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  if (unit.depth !== 0) {
    throw new AppError({
      message:
        "Chỉ đơn vị cấp 1 được tạo/sửa dữ liệu dùng chung (LTTP, bảng giá, chức danh)",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }
}
