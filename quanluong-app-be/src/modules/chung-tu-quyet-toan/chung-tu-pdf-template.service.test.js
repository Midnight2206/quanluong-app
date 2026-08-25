import assert from "node:assert/strict";
import { mock, test } from "node:test";

process.env.DATABASE_URL ||= "mysql://test:test@localhost/test";
process.env.JWT_ACCESS_SECRET ||= "test-jwt-secret";
process.env.SESSION_SECRET ||= "test-session-secret";

const uploadTemplate = mock.fn(async ({ buffer, name, version }) => ({
  id: 42,
  name,
  version,
  bufferLength: buffer?.length ?? 0,
}));

const previewTemplatePdfResponse = mock.fn(
  async (templateId) =>
    new Response(`preview-${templateId}`, {
      status: 200,
      headers: { "content-type": "application/pdf" },
    }),
);
const publishTemplate = mock.fn(async (templateId) => ({ id: templateId, status: "published" }));
const retireTemplate = mock.fn(async (templateId) => ({ id: templateId, status: "retired" }));
const getTemplateFields = mock.fn(async (templateId) => [
  { key: "don_vi", label: "Đơn vị", templateId },
]);

const prismaFindMany = mock.fn(async () => []);
const prismaCreate = mock.fn(async ({ data }) => ({ id: 1, status: "draft", ...data }));
const prismaFindUnique = mock.fn(async () => null);
const prismaUpdate = mock.fn(async ({ where, data }) => ({ id: where.id, ...data }));

mock.module("../../services/document-service.client.js", {
  exports: {
    getTemplateFields,
    previewTemplatePdfResponse,
    publishTemplate,
    retireTemplate,
    uploadTemplate,
  },
});

mock.module("../../infra/database/prisma/prisma.client.js", {
  exports: {
    prisma: {
      chungTuPdfTemplate: {
        findMany: prismaFindMany,
        create: prismaCreate,
        findUnique: prismaFindUnique,
        update: prismaUpdate,
      },
    },
  },
});

const { AppError } = await import("../../errors/app-error.js");
const { ERROR_CODES } = await import("../../errors/error-codes.js");
const {
  createChungTuPdfTemplate,
  getChungTuPdfTemplateFields,
  listChungTuPdfTemplates,
  previewChungTuPdfTemplate,
  publishChungTuPdfTemplate,
  retireChungTuPdfTemplate,
} = await import("./chung-tu-pdf-template.service.js");

test.beforeEach(() => {
  uploadTemplate.mock.resetCalls();
  previewTemplatePdfResponse.mock.resetCalls();
  publishTemplate.mock.resetCalls();
  retireTemplate.mock.resetCalls();
  getTemplateFields.mock.resetCalls();
  prismaFindMany.mock.resetCalls();
  prismaCreate.mock.resetCalls();
  prismaFindUnique.mock.resetCalls();
  prismaUpdate.mock.resetCalls();
});

test("listChungTuPdfTemplates includeNonPublished omits status filter", async () => {
  prismaFindMany.mock.resetCalls();
  await listChungTuPdfTemplates({
    categoryKey: "bang-ke-mua-hang",
    includeNonPublished: true,
  });
  const call = prismaFindMany.mock.calls[0].arguments[0];
  assert.equal(call.where.categoryKey, "bang-ke-mua-hang");
  assert.equal(Object.prototype.hasOwnProperty.call(call.where, "status"), false);
});

test("getChungTuPdfTemplateFields allowNonPublished returns retired row fields", async () => {
  prismaFindUnique.mock.mockImplementation(async () => ({
    id: 3,
    status: "retired",
    documentServiceTemplateId: 42,
  }));
  getTemplateFields.mock.resetCalls();
  const result = await getChungTuPdfTemplateFields({ id: 3, allowNonPublished: true });
  assert.equal(result.template.id, 3);
  assert.equal(getTemplateFields.mock.callCount(), 1);
});

test("listChungTuPdfTemplates filters by categoryKey and published status", async () => {
  const rows = [{ id: 9, categoryKey: "phieu-nhap-kho", status: "published" }];
  prismaFindMany.mock.mockImplementation(async () => rows);

  const result = await listChungTuPdfTemplates({ categoryKey: " phieu-nhap-kho " });

  assert.deepEqual(result, rows);
  assert.equal(prismaFindMany.mock.callCount(), 1);
  assert.deepEqual(prismaFindMany.mock.calls[0].arguments[0], {
    where: { categoryKey: "phieu-nhap-kho", status: "published" },
    orderBy: [{ updatedAt: "desc" }],
  });
});

test("createChungTuPdfTemplate uploads then persists document-service template id", async () => {
  const buffer = Buffer.from("pdf-template");
  const created = {
    id: 7,
    categoryKey: "bang-ke-mua-hang",
    displayName: "Biên bản A",
    documentServiceTemplateId: 42,
    name: "bien-ban-a",
    version: "v1",
    uploadedById: 3,
    status: "draft",
  };
  prismaCreate.mock.mockImplementation(async () => created);

  const result = await createChungTuPdfTemplate({
    categoryKey: "bang-ke-mua-hang",
    displayName: "Biên bản A",
    name: "bien-ban-a",
    version: "v1",
    buffer,
    uploadedById: 3,
  });

  assert.equal(uploadTemplate.mock.callCount(), 1);
  assert.deepEqual(uploadTemplate.mock.calls[0].arguments[0], {
    buffer,
    name: "bien-ban-a",
    version: "v1",
  });
  assert.equal(prismaCreate.mock.callCount(), 1);
  assert.deepEqual(prismaCreate.mock.calls[0].arguments[0], {
    data: {
      categoryKey: "bang-ke-mua-hang",
      displayName: "Biên bản A",
      documentServiceTemplateId: 42,
      name: "bien-ban-a",
      version: "v1",
      uploadedById: 3,
    },
  });
  assert.deepEqual(result, created);
});

test("publishChungTuPdfTemplate publishes draft row in document service and prisma", async () => {
  const row = {
    id: 5,
    status: "draft",
    documentServiceTemplateId: 11,
    categoryKey: "phieu-xuat-kho",
  };
  const published = { ...row, status: "published" };
  prismaFindUnique.mock.mockImplementation(async () => row);
  prismaUpdate.mock.mockImplementation(async () => published);

  const result = await publishChungTuPdfTemplate({ id: "5" });

  assert.equal(prismaFindUnique.mock.callCount(), 1);
  assert.deepEqual(prismaFindUnique.mock.calls[0].arguments[0], { where: { id: 5 } });
  assert.equal(publishTemplate.mock.callCount(), 1);
  assert.deepEqual(publishTemplate.mock.calls[0].arguments, [11]);
  assert.equal(prismaUpdate.mock.callCount(), 1);
  assert.deepEqual(prismaUpdate.mock.calls[0].arguments[0], {
    where: { id: 5 },
    data: { status: "published" },
  });
  assert.deepEqual(result, published);
});

test("retireChungTuPdfTemplate retires published row in document service and prisma", async () => {
  const row = {
    id: 6,
    status: "published",
    documentServiceTemplateId: 12,
    categoryKey: "phieu-xuat-kho",
  };
  const retired = { ...row, status: "retired" };
  prismaFindUnique.mock.mockImplementation(async () => row);
  prismaUpdate.mock.mockImplementation(async () => retired);

  const result = await retireChungTuPdfTemplate({ id: "6" });

  assert.equal(prismaFindUnique.mock.callCount(), 1);
  assert.deepEqual(prismaFindUnique.mock.calls[0].arguments[0], { where: { id: 6 } });
  assert.equal(retireTemplate.mock.callCount(), 1);
  assert.deepEqual(retireTemplate.mock.calls[0].arguments, [12]);
  assert.equal(prismaUpdate.mock.callCount(), 1);
  assert.deepEqual(prismaUpdate.mock.calls[0].arguments[0], {
    where: { id: 6 },
    data: { status: "retired" },
  });
  assert.deepEqual(result, retired);
});

test("getChungTuPdfTemplateFields loads fields from document service", async () => {
  const row = {
    id: 2,
    status: "published",
    documentServiceTemplateId: 99,
    categoryKey: "phieu-nhap-kho",
  };
  prismaFindUnique.mock.mockImplementation(async () => row);

  const result = await getChungTuPdfTemplateFields({ id: 2 });

  assert.equal(getTemplateFields.mock.callCount(), 1);
  assert.deepEqual(getTemplateFields.mock.calls[0].arguments, [99]);
  assert.deepEqual(result, {
    template: row,
    fields: [{ key: "don_vi", label: "Đơn vị", templateId: 99 }],
  });
});

test("previewChungTuPdfTemplate returns upstream response for existing row", async () => {
  prismaFindUnique.mock.mockImplementation(async () => ({
    id: 8,
    status: "retired",
    documentServiceTemplateId: 123,
  }));

  const result = await previewChungTuPdfTemplate({ id: 8 });

  assert.equal(previewTemplatePdfResponse.mock.callCount(), 1);
  assert.deepEqual(previewTemplatePdfResponse.mock.calls[0].arguments, [123]);
  assert.equal(result.fallbackContentDisposition, 'inline; filename="preview-123.pdf"');
  assert.equal(result.upstreamResponse.headers.get("content-type"), "application/pdf");
  assert.equal(await result.upstreamResponse.text(), "preview-123");
});

test("unsupported categoryKey throws validation AppError", async () => {
  await assert.rejects(
    () => listChungTuPdfTemplates({ categoryKey: "unknown-category" }),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 400 &&
      error.code === ERROR_CODES.VALIDATION_ERROR &&
      /Loại chứng từ không hỗ trợ PDF/i.test(error.message),
  );
  assert.equal(prismaFindMany.mock.callCount(), 0);
});
