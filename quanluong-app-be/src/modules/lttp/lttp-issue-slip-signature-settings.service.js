import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  assertUnitIdInScope,
  getSubtreeUnitIds,
  getUnitBreadcrumbChain,
} from "../../shared/units/unit-scope.service.js";
import { resolvePrivateStorageUnitId } from "../../shared/data-scope/unit-data-policy.service.js";
import {
  getDefaultLttpIssueSlipSignatureBlock,
  normalizeLttpIssueSlipExtraFields,
  normalizeLttpIssueSlipSignatureBlock,
  pickNguoiDuyetSlot,
} from "./lttp-issue-slip-signature-defaults.js";

const ADMIN_TYPE_NAME = "admin";
const SUPERADMIN_TYPE_NAME = "superadmin";

function assertUnitInEffectiveBranch(unitId, effectiveUnitIds) {
  const uid =
    unitId !== null && unitId !== undefined && unitId !== "" ? Number(unitId) : unitId;
  if (
    effectiveUnitIds != null &&
    effectiveUnitIds.length > 0 &&
    !effectiveUnitIds.some((id) => Number(id) === Number(uid))
  ) {
    throw new AppError({
      message: "Đơn vị ngoài nhánh đang chọn (X-Target-Unit-Id).",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }
}
function assertLttpLogicalMatchesDataScope(unitId, dataScope) {
  if (!dataScope || dataScope.storageUnitId == null) {
    throw new AppError({
      message: "Thiếu phạm vi dữ liệu LTTP",
      statusCode: 500,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  if (Number(unitId) !== Number(dataScope.logicalUnitId)) {
    throw new AppError({
      message: "unitId không khớp ngữ cảnh phạm vi dữ liệu",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

function mapRow(row, unitId) {
  if (!row) return null;
  return {
    id: row.id,
    unitId: row.unitId,
    signatureBlock: normalizeLttpIssueSlipSignatureBlock(row.signatureBlockJson),
    extraFields: normalizeLttpIssueSlipExtraFields(row.extraFieldsJson),
    updatedById: row.updatedById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function emptyResponse(unitId) {
  return {
    unitId,
    signatureBlock: getDefaultLttpIssueSlipSignatureBlock(),
    extraFields: normalizeLttpIssueSlipExtraFields({}),
  };
}

function isPrivilegedApproverEditor(user) {
  const name = user?.type?.name ?? user?.typeName ?? null;
  return name === ADMIN_TYPE_NAME || name === SUPERADMIN_TYPE_NAME;
}

async function resolveApproverPickUnitIds(logicalUnitId) {
  const uid = Number(logicalUnitId);
  const { storageUnitId } = await resolvePrivateStorageUnitId({
    logicalUnitId: uid,
    dataKind: "LTTP_COMMODITY",
  });
  const rootId = storageUnitId ?? uid;
  const subtreeIds = await getSubtreeUnitIds(rootId);
  const chain = await getUnitBreadcrumbChain(uid);
  const ancestorIds = chain.map((u) => u.id);
  const rootIdx = ancestorIds.indexOf(rootId);
  const upToRoot = rootIdx >= 0 ? ancestorIds.slice(0, rootIdx + 1) : ancestorIds;
  return [...new Set([...subtreeIds, ...upToRoot])];
}

async function assertApproverUserIsUnitAdmin(userId, logicalUnitId) {
  const pickUnitIds = await resolveApproverPickUnitIds(logicalUnitId);
  const u = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
      isActive: true,
      unitId: { in: pickUnitIds.length ? pickUnitIds : [Number(logicalUnitId)] },
      type: { name: ADMIN_TYPE_NAME },
    },
    select: {
      id: true,
      username: true,
      unitId: true,
      profile: { select: { fullName: true, rankFull: true, rankAbbr: true, signatureUrl: true } },
    },
  });
  if (!u) {
    throw new AppError({
      message: "Người duyệt phải là admin đơn vị trong nhánh kho LTTP đã chọn.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return u;
}

function displayNameFromAdmin(u) {
  if (!u) return "";
  const full = String(u.profile?.fullName ?? "").trim();
  const rank = String(u.profile?.rankFull ?? "").trim();
  const name = full || String(u.username ?? "").trim();
  return [rank, name].filter(Boolean).join(" ");
}

async function listIssueSlipApproverAdmins(
  { unitId },
  scope,
  effectiveUnitIds,
  dataScope,
) {
  assertLttpLogicalMatchesDataScope(unitId, dataScope);
  assertUnitIdInScope(unitId, scope);
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const pickUnitIds = await resolveApproverPickUnitIds(unitId);
  if (!pickUnitIds.length) return [];
  const rows = await prisma.user.findMany({
    where: {
      unitId: { in: pickUnitIds },
      deletedAt: null,
      isActive: true,
      type: { name: ADMIN_TYPE_NAME },
    },
    select: {
      id: true,
      username: true,
      unitId: true,
      profile: { select: { fullName: true, rankFull: true, rankAbbr: true, signatureUrl: true } },
    },
    orderBy: { id: "asc" },
  });
  return rows.map((u) => ({
    id: u.id,
    username: u.username,
    fullName: u.profile?.fullName ?? null,
    rankAbbr: u.profile?.rankAbbr ?? null,
    rankFull: u.profile?.rankFull ?? null,
    displayName: displayNameFromAdmin(u),
    unitId: u.unitId,
    hasSignature: Boolean(u.profile?.signatureUrl),
  }));
}

async function getLttpIssueSlipSignatureSettings(
  { unitId },
  scope,
  effectiveUnitIds,
  dataScope,
) {
  assertLttpLogicalMatchesDataScope(unitId, dataScope);
  assertUnitIdInScope(unitId, scope);
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const row = await prisma.lttpIssueSlipSignatureSettings.findUnique({
    where: { unitId: storageUnitId },
  });
  const mapped = mapRow(row, storageUnitId);
  if (mapped) return mapped;
  return emptyResponse(storageUnitId);
}

async function upsertLttpIssueSlipSignatureSettings(
  { unitId, signatureBlock, extraFields, updatedById, actorUser },
  scope,
  effectiveUnitIds,
  dataScope,
) {
  assertLttpLogicalMatchesDataScope(unitId, dataScope);
  assertUnitIdInScope(unitId, scope);
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const uid = Number(updatedById);
  if (!Number.isInteger(uid) || uid <= 0) {
    throw new AppError({
      message: "Thiếu người cập nhật cấu hình chữ ký.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const block = normalizeLttpIssueSlipSignatureBlock(signatureBlock);
  const extras = normalizeLttpIssueSlipExtraFields(extraFields);
  const duyet = pickNguoiDuyetSlot(block);

  // Chỉ admin/superadmin được đổi người duyệt / bật chữ ký số ô duyệt.
  const existing = await prisma.lttpIssueSlipSignatureSettings.findUnique({
    where: { unitId: storageUnitId },
  });
  const prevBlock = normalizeLttpIssueSlipSignatureBlock(existing?.signatureBlockJson);
  const prevDuyet = pickNguoiDuyetSlot(prevBlock);
  const approverChanged =
    Number(prevDuyet?.approverUserId ?? 0) !== Number(duyet?.approverUserId ?? 0) ||
    Boolean(prevDuyet?.approverIsSelf) !== Boolean(duyet?.approverIsSelf) ||
    Boolean(prevDuyet?.useDigitalSignature !== false) !==
      Boolean(duyet?.useDigitalSignature !== false) ||
    String(prevDuyet?.static_name ?? "") !== String(duyet?.static_name ?? "");

  if (approverChanged && !isPrivilegedApproverEditor(actorUser)) {
    throw new AppError({
      message: "Chỉ admin đơn vị được chọn / đổi người duyệt và chữ ký số ô duyệt.",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }

  if (duyet?.approverUserId != null) {
    const adminUser = await assertApproverUserIsUnitAdmin(duyet.approverUserId, unitId);
    // Linked user: source=dynamic (giống người viết/nhận) — PDF lấy tên từ signatures.
    // static_name chỉ là nhãn preview FE (rankFull); doc-service không dùng khi dynamic.
    const previewName = displayNameFromAdmin(adminUser);
    block.slots = block.slots.map((s) =>
      s.key === "nguoi_duyet"
        ? {
            ...s,
            source: "dynamic",
            static_name: previewName,
            approverUserId: duyet.approverUserId,
            approverIsSelf: Boolean(duyet.approverIsSelf),
            useDigitalSignature: duyet.useDigitalSignature !== false,
          }
        : s,
    );
  } else {
    // Unlinked: cho phép static text (hoặc dynamic trống).
    block.slots = block.slots.map((s) =>
      s.key === "nguoi_duyet"
        ? {
            ...s,
            source: s.source === "static" ? "static" : "dynamic",
            approverUserId: null,
            approverIsSelf: false,
            useDigitalSignature: s.useDigitalSignature !== false,
          }
        : s,
    );
  }

  const row = await prisma.lttpIssueSlipSignatureSettings.upsert({
    where: { unitId: storageUnitId },
    create: {
      unitId: storageUnitId,
      signatureBlockJson: block,
      extraFieldsJson: extras,
      updatedById: uid,
    },
    update: {
      signatureBlockJson: block,
      extraFieldsJson: extras,
      updatedById: uid,
    },
  });
  return mapRow(row, storageUnitId);
}

export {
  emptyResponse,
  getLttpIssueSlipSignatureSettings,
  isPrivilegedApproverEditor,
  listIssueSlipApproverAdmins,
  upsertLttpIssueSlipSignatureSettings,
};
