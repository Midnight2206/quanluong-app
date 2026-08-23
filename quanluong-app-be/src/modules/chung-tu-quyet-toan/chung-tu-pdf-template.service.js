import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  getTemplateFields,
  uploadTemplate,
} from "../../services/document-service.client.js";

const ALLOWED_CHUNG_TU_PDF_CATEGORIES = new Set([
  "bang-ke-mua-hang",
  "phieu-xuat-kho",
  "phieu-nhap-kho",
]);

function normalizeCategoryKey(value) {
  return String(value ?? "").trim();
}

function assertSupportedPdfCategory(categoryKey) {
  if (!ALLOWED_CHUNG_TU_PDF_CATEGORIES.has(categoryKey)) {
    throw new AppError({
      message: "Loại chứng từ không hỗ trợ PDF.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

function resolveDocumentServiceTemplateId(uploaded) {
  const rawId = uploaded?.id ?? uploaded?.template_id;
  const templateId = Number(rawId);
  if (!Number.isInteger(templateId) || templateId <= 0) {
    throw new AppError({
      message: "Document service không trả về template id hợp lệ.",
      statusCode: 502,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  return templateId;
}

async function listChungTuPdfTemplates({ categoryKey }) {
  const normalizedCategoryKey = normalizeCategoryKey(categoryKey);
  assertSupportedPdfCategory(normalizedCategoryKey);
  return prisma.chungTuPdfTemplate.findMany({
    where: {
      categoryKey: normalizedCategoryKey,
      isActive: true,
    },
    orderBy: [{ updatedAt: "desc" }],
  });
}

async function createChungTuPdfTemplate({
  categoryKey,
  displayName,
  name,
  version,
  buffer,
  uploadedById,
}) {
  const normalizedCategoryKey = normalizeCategoryKey(categoryKey);
  assertSupportedPdfCategory(normalizedCategoryKey);

  const uploaded = await uploadTemplate({
    buffer,
    name,
    version,
  });

  try {
    return await prisma.chungTuPdfTemplate.create({
      data: {
        categoryKey: normalizedCategoryKey,
        displayName: displayName || name,
        documentServiceTemplateId: resolveDocumentServiceTemplateId(uploaded),
        name,
        version,
        uploadedById,
      },
    });
  } catch (error) {
    if (error?.code === "P2002") {
      throw new AppError({
        message: "Đã có mẫu PDF này cho loại chứng từ.",
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
      });
    }
    throw error;
  }
}

async function deactivateChungTuPdfTemplate({ id }) {
  const row = await prisma.chungTuPdfTemplate.findUnique({
    where: { id: Number(id) },
  });
  if (!row || !row.isActive) {
    throw new AppError({
      message: "Không tìm thấy mẫu PDF.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  return prisma.chungTuPdfTemplate.update({
    where: { id: row.id },
    data: { isActive: false },
  });
}

async function getChungTuPdfTemplateFields({ id }) {
  const row = await prisma.chungTuPdfTemplate.findUnique({
    where: { id: Number(id) },
  });
  if (!row || !row.isActive) {
    throw new AppError({
      message: "Không tìm thấy mẫu PDF.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  const fields = await getTemplateFields(row.documentServiceTemplateId);
  return {
    template: row,
    fields,
  };
}

export {
  createChungTuPdfTemplate,
  deactivateChungTuPdfTemplate,
  getChungTuPdfTemplateFields,
  listChungTuPdfTemplates,
};
