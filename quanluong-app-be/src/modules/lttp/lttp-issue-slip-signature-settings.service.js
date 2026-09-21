import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { assertUnitIdInScope } from "../../shared/units/unit-scope.service.js";
import {
  getDefaultLttpIssueSlipSignatureBlock,
  normalizeLttpIssueSlipExtraFields,
  normalizeLttpIssueSlipSignatureBlock,
} from "./lttp-issue-slip-signature-defaults.js";

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
  { unitId, signatureBlock, extraFields, updatedById },
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
  upsertLttpIssueSlipSignatureSettings,
};
