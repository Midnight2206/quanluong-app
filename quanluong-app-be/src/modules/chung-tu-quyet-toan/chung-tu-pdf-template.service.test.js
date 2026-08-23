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

const getTemplateFields = mock.fn(async (templateId) => [
  { key: "don_vi", label: "Đơn vị", templateId },
]);

const prismaFindMany = mock.fn(async () => []);
const prismaCreate = mock.fn(async ({ data }) => ({ id: 1, isActive: true, ...data }));
const prismaFindUnique = mock.fn(async () => null);
const prismaUpdate = mock.fn(async ({ where, data }) => ({ id: where.id, isActive: false, ...data }));

mock.module("../../services/document-service.client.js", {
  exports: { getTemplateFields, uploadTemplate },
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
  deactivateChungTuPdfTemplate,
  getChungTuPdfTemplateFields,
  listChungTuPdfTemplates,
} = await import("./chung-tu-pdf-template.service.js");

test.beforeEach(() => {
  uploadTemplate.mock.resetCalls();
  getTemplateFields.mock.resetCalls();
  prismaFindMany.mock.resetCalls();
  prismaCreate.mock.resetCalls();
  prismaFindUnique.mock.resetCalls();
  prismaUpdate.mock.resetCalls();
});

test("listChungTuPdfTemplates filters by categoryKey and isActive", async () => {
  const rows = [{ id: 9, categoryKey: "phieu-nhap-kho", isActive: true }];
  prismaFindMany.mock.mockImplementation(async () => rows);

  const result = await listChungTuPdfTemplates({ categoryKey: " phieu-nhap-kho " });

  assert.deepEqual(result, rows);
  assert.equal(prismaFindMany.mock.callCount(), 1);
  assert.deepEqual(prismaFindMany.mock.calls[0].arguments[0], {
    where: { categoryKey: "phieu-nhap-kho", isActive: true },
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
    isActive: true,
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

test("deactivateChungTuPdfTemplate soft-deletes active row", async () => {
  const row = {
    id: 5,
    isActive: true,
    documentServiceTemplateId: 11,
    categoryKey: "phieu-xuat-kho",
  };
  const deactivated = { ...row, isActive: false };
  prismaFindUnique.mock.mockImplementation(async () => row);
  prismaUpdate.mock.mockImplementation(async () => deactivated);

  const result = await deactivateChungTuPdfTemplate({ id: "5" });

  assert.equal(prismaFindUnique.mock.callCount(), 1);
  assert.deepEqual(prismaFindUnique.mock.calls[0].arguments[0], { where: { id: 5 } });
  assert.equal(prismaUpdate.mock.callCount(), 1);
  assert.deepEqual(prismaUpdate.mock.calls[0].arguments[0], {
    where: { id: 5 },
    data: { isActive: false },
  });
  assert.deepEqual(result, deactivated);
});

test("getChungTuPdfTemplateFields loads fields from document service", async () => {
  const row = {
    id: 2,
    isActive: true,
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
