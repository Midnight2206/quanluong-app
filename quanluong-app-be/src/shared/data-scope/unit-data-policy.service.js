import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { getDataKindDefinition } from "./data-scope.registry.js";

const DEFAULT_POLICY = "INDEPENDENT";

/**
 * @param {string} path
 * @returns {number[]} ids từ gốc xuống lá (theo path lưu trong Unit)
 */
function unitIdsFromPath(path) {
  if (!path || typeof path !== "string") {
    return [];
  }
  return path
    .split("/")
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0);
}

/**
 * Chuỗi từ đơn vị hiện tại lên gốc [self, parent, ..., root].
 */
async function getSelfToRootChain(unitId) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { id: true, path: true },
  });
  if (!unit) {
    return [];
  }
  const forward = unitIdsFromPath(unit.path);
  if (forward.length > 0) {
    return [...forward].reverse();
  }

  const chain = [];
  let id = unit.id;
  const seen = new Set();
  while (id != null && !seen.has(id)) {
    seen.add(id);
    chain.push(id);
    const row = await prisma.unit.findUnique({
      where: { id },
      select: { parentId: true },
    });
    id = row?.parentId ?? null;
  }
  return chain;
}

/**
 * @param {number[]} unitIds
 * @param {Date} asOf
 * @returns {Promise<Map<number, string>>}
 */
async function getIsolationPoliciesAtForUnits(unitIds, asOf) {
  const map = new Map();
  if (!unitIds.length) {
    return map;
  }

  const rows = await prisma.unitDataPolicyPeriod.findMany({
    where: {
      unitId: { in: unitIds },
      validFrom: { lte: asOf },
      OR: [{ validTo: null }, { validTo: { gt: asOf } }],
    },
    orderBy: [{ unitId: "asc" }, { validFrom: "desc" }],
    select: { unitId: true, policy: true },
  });

  for (const r of rows) {
    if (!map.has(r.unitId)) {
      map.set(r.unitId, r.policy);
    }
  }
  for (const id of unitIds) {
    if (!map.has(id)) {
      map.set(id, DEFAULT_POLICY);
    }
  }
  return map;
}

/**
 * Chính sách isolation tại `asOf` (không có lịch sử → INDEPENDENT).
 * @param {number} unitId
 * @param {Date} [asOf]
 */
export async function getIsolationPolicyAt(unitId, asOf = new Date()) {
  const map = await getIsolationPoliciesAtForUnits([unitId], asOf);
  return map.get(unitId) ?? DEFAULT_POLICY;
}

/**
 * @param {{ consumerUnitId: number, dataKind: string, recordId?: number, asOf?: Date }} args
 */
export async function findActiveShareGrant({
  consumerUnitId,
  dataKind,
  recordId,
  asOf = new Date(),
}) {
  const window = {
    consumerUnitId,
    dataKind,
    validFrom: { lte: asOf },
    OR: [{ validTo: null }, { validTo: { gt: asOf } }],
  };

  if (recordId != null && Number.isInteger(recordId) && recordId > 0) {
    const specific = await prisma.unitPrivateDataShareGrant.findFirst({
      where: { ...window, recordId },
      orderBy: { validFrom: "desc" },
    });
    if (specific) {
      return specific;
    }
  }

  return prisma.unitPrivateDataShareGrant.findFirst({
    where: { ...window, recordId: null },
    orderBy: { validFrom: "desc" },
  });
}

/**
 * Đơn vị “kho” dữ liệu private mà request nên dùng khi đọc/ghi.
 * Public kind → storageUnitId null.
 *
 * @param {{ logicalUnitId: number, dataKind: string, recordId?: number, asOf?: Date }} args
 * @returns {Promise<{ storageUnitId: number | null, via: string }>}
 */
export async function resolvePrivateStorageUnitId({
  logicalUnitId,
  dataKind,
  recordId,
  asOf = new Date(),
}) {
  const def = getDataKindDefinition(dataKind);
  if (!def || def.visibility !== "private") {
    return { storageUnitId: null, via: "public_kind" };
  }

  const grant = await findActiveShareGrant({
    consumerUnitId: logicalUnitId,
    dataKind,
    recordId,
    asOf,
  });
  if (grant) {
    return { storageUnitId: grant.ownerUnitId, via: "explicit_grant" };
  }

  const chain = await getSelfToRootChain(logicalUnitId);
  if (!chain.length) {
    return { storageUnitId: logicalUnitId, via: "missing_unit_chain" };
  }

  const policyMap = await getIsolationPoliciesAtForUnits(chain, asOf);
  for (const uid of chain) {
    if (policyMap.get(uid) === "INDEPENDENT") {
      return { storageUnitId: uid, via: "nearest_independent_ancestor" };
    }
  }

  const rootId = chain[chain.length - 1];
  return { storageUnitId: rootId, via: "fallback_root" };
}

/**
 * Đóng kỳ đang mở (validTo null) và mở kỳ mới — hỗ trợ đổi chế độ nhiều lần.
 * @param {{ unitId: number, policy: 'INDEPENDENT' | 'INHERIT_PRIVATE', validFrom: Date, note?: string | null, tx?: object }} args
 */
export async function appendPolicyChange({
  unitId,
  policy,
  validFrom,
  note,
  tx = prisma,
}) {
  await tx.unitDataPolicyPeriod.updateMany({
    where: { unitId, validTo: null },
    data: { validTo: validFrom },
  });
  await tx.unitDataPolicyPeriod.create({
    data: {
      unitId,
      policy,
      validFrom,
      validTo: null,
      note: note ?? null,
    },
  });
}
