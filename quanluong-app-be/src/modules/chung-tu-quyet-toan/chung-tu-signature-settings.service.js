import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { assertKnownCategoryKey } from "./chung-tu-category.constants.js";
import { getCatalogNodesForCategory } from "./chung-tu-signature-catalog.js";

function mapSignatureSettingsRow(row, categoryKey) {
  if (!row) return null;
  return {
    id: row.id,
    categoryKey: row.categoryKey,
    signatureBlock:
      row.signatureBlockJson && typeof row.signatureBlockJson === "object"
        ? row.signatureBlockJson
        : {},
    availableCatalogNodes: getCatalogNodesForCategory(categoryKey ?? row.categoryKey),
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
  const mapped = mapSignatureSettingsRow(row, categoryKey);
  if (mapped) return mapped;
  return {
    categoryKey,
    availableCatalogNodes: getCatalogNodesForCategory(categoryKey),
  };
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
  return mapSignatureSettingsRow(row, categoryKey);
}

export { getChungTuSignatureSettings, upsertChungTuSignatureSettings };
