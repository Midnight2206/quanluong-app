import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import {
  getTemplateFields,
  previewTemplatePdfResponse,
  publishTemplate,
  retireTemplate,
  uploadTemplate,
} from "../../services/document-service.client.js";
import { CHUNG_TU_CATEGORY_KEYS } from "./chung-tu-category.constants.js";

const ALLOWED_CHUNG_TU_PDF_CATEGORIES = new Set(Object.values(CHUNG_TU_CATEGORY_KEYS));

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

function notFoundError() {
  return new AppError({
    message: "Không tìm thấy mẫu PDF.",
    statusCode: 404,
    code: ERROR_CODES.NOT_FOUND,
  });
}

function isConflictError(error) {
  return error instanceof AppError && error.statusCode === 409;
}

function normalizeFieldLabels(fieldLabels) {
  if (!fieldLabels || typeof fieldLabels !== "object" || Array.isArray(fieldLabels)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(fieldLabels).map(([key, value]) => [
      String(key),
      typeof value === "string" ? value : String(value ?? ""),
    ]),
  );
}

function mapChungTuPdfTemplate(row) {
  if (!row) {
    return row;
  }
  return {
    ...row,
    fieldLabels: normalizeFieldLabels(row.fieldLabelsJson),
  };
}

async function listChungTuPdfTemplates({ categoryKey, includeNonPublished = false }) {
  const normalizedCategoryKey = normalizeCategoryKey(categoryKey);
  assertSupportedPdfCategory(normalizedCategoryKey);
  const rows = await prisma.chungTuPdfTemplate.findMany({
    where: {
      categoryKey: normalizedCategoryKey,
      ...(includeNonPublished ? {} : { status: "published" }),
    },
    orderBy: [{ updatedAt: "desc" }],
  });
  return rows.map(mapChungTuPdfTemplate);
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
  const priorTemplate = await prisma.chungTuPdfTemplate.findFirst({
    where: {
      categoryKey: normalizedCategoryKey,
      name,
    },
    orderBy: [{ updatedAt: "desc" }],
    select: { fieldLabelsJson: true },
  });
  const fieldLabelsJson = normalizeFieldLabels(priorTemplate?.fieldLabelsJson);

  const uploaded = await uploadTemplate({
    buffer,
    name,
    version,
  });

  try {
    const row = await prisma.chungTuPdfTemplate.create({
      data: {
        categoryKey: normalizedCategoryKey,
        displayName: displayName || name,
        documentServiceTemplateId: resolveDocumentServiceTemplateId(uploaded),
        name,
        version,
        uploadedById,
        fieldLabelsJson,
      },
    });
    return mapChungTuPdfTemplate(row);
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

async function publishChungTuPdfTemplate({ id }) {
  const row = await prisma.chungTuPdfTemplate.findUnique({
    where: { id: Number(id) },
  });
  if (!row) {
    throw notFoundError();
  }
  if (row.status !== "draft") {
    throw new AppError({
      message: "Chỉ mẫu nháp mới publish được.",
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
    });
  }
  try {
    await publishTemplate(row.documentServiceTemplateId);
  } catch (error) {
    if (!isConflictError(error)) {
      throw error;
    }
  }
  const updatedRow = await prisma.chungTuPdfTemplate.update({
    where: { id: row.id },
    data: { status: "published" },
  });
  return mapChungTuPdfTemplate(updatedRow);
}

async function retireChungTuPdfTemplate({ id }) {
  const row = await prisma.chungTuPdfTemplate.findUnique({
    where: { id: Number(id) },
  });
  if (!row) {
    throw notFoundError();
  }
  if (row.status !== "draft" && row.status !== "published") {
    throw new AppError({
      message: "Chỉ mẫu nháp hoặc đã publish mới retire được.",
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
    });
  }
  try {
    await retireTemplate(row.documentServiceTemplateId);
  } catch (error) {
    if (!isConflictError(error)) {
      throw error;
    }
  }
  const updatedRow = await prisma.chungTuPdfTemplate.update({
    where: { id: row.id },
    data: { status: "retired" },
  });
  return mapChungTuPdfTemplate(updatedRow);
}

async function updateChungTuPdfTemplateFieldLabels({ id, fieldLabels }) {
  const row = await prisma.chungTuPdfTemplate.findUnique({
    where: { id: Number(id) },
  });
  if (!row) {
    throw notFoundError();
  }
  if (row.status === "retired") {
    throw new AppError({
      message: "Mẫu đã retire thì không sửa nhãn field được.",
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
    });
  }
  const updatedRow = await prisma.chungTuPdfTemplate.update({
    where: { id: row.id },
    data: {
      fieldLabelsJson: normalizeFieldLabels(fieldLabels),
    },
  });
  return mapChungTuPdfTemplate(updatedRow);
}

async function getChungTuPdfTemplateFields({ id, allowNonPublished = false }) {
  const row = await prisma.chungTuPdfTemplate.findUnique({
    where: { id: Number(id) },
  });
  if (!row || (row.status !== "published" && !allowNonPublished)) {
    throw notFoundError();
  }
  const fields = await getTemplateFields(row.documentServiceTemplateId);
  return {
    template: mapChungTuPdfTemplate(row),
    fields,
  };
}

async function previewChungTuPdfTemplate({ id }) {
  const row = await prisma.chungTuPdfTemplate.findUnique({
    where: { id: Number(id) },
  });
  if (!row) {
    throw notFoundError();
  }
  return {
    upstreamResponse: await previewTemplatePdfResponse(row.documentServiceTemplateId),
    fallbackContentDisposition: `inline; filename="preview-${row.documentServiceTemplateId}.pdf"`,
  };
}

export {
  createChungTuPdfTemplate,
  getChungTuPdfTemplateFields,
  listChungTuPdfTemplates,
  previewChungTuPdfTemplate,
  publishChungTuPdfTemplate,
  retireChungTuPdfTemplate,
  updateChungTuPdfTemplateFieldLabels,
};
