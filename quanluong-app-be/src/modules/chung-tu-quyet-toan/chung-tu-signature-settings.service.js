import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { assertKnownCategoryKey } from "./chung-tu-category.constants.js";

function mapSignatureSettingsRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    categoryKey: row.categoryKey,
    signatureBlock:
      row.signatureBlockJson && typeof row.signatureBlockJson === "object"
        ? row.signatureBlockJson
        : {},
    updatedById: row.updatedById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getChungTuSignatureSettings({ categoryKey }) {
  assertKnownCategoryKey(categoryKey);
  const row = await prisma.chungTuSignatureSettings.findUnique({
    where: { categoryKey },
  });
  return mapSignatureSettingsRow(row);
}

async function upsertChungTuSignatureSettings({ categoryKey, signatureBlock, updatedById }) {
  assertKnownCategoryKey(categoryKey);
  const payload =
    signatureBlock && typeof signatureBlock === "object" && !Array.isArray(signatureBlock)
      ? signatureBlock
      : {};
  const row = await prisma.chungTuSignatureSettings.upsert({
    where: { categoryKey },
    create: {
      categoryKey,
      signatureBlockJson: payload,
      updatedById,
    },
    update: {
      signatureBlockJson: payload,
      updatedById,
    },
  });
  return mapSignatureSettingsRow(row);
}

export { getChungTuSignatureSettings, upsertChungTuSignatureSettings };
