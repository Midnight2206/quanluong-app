import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const apiSource = readFileSync(
  new URL("../../../features/chung-tu-quyet-toan/api/chungTuPdfApi.js", import.meta.url),
  "utf8",
);
const superadminTemplatesSource = readFileSync(
  new URL("./SuperadminChungTuPdfCategoryTemplates.jsx", import.meta.url),
  "utf8",
);

test("superadmin PDF templates screen saves per-template field labels", () => {
  assert.match(apiSource, /useUpdateChungTuPdfTemplateFieldLabelsMutation/);
  assert.match(
    apiSource,
    /\/chungtuquyettoan\/pdf-templates\/\$\{encodeURIComponent\(templateId\)\}\/field-labels/,
  );
  assert.match(superadminTemplatesSource, /Nhãn field/);
  assert.match(superadminTemplatesSource, /templateLabelFields/);
  assert.match(superadminTemplatesSource, /resolvePdfScalarFieldKey/);
  assert.match(superadminTemplatesSource, /chungTuLabelField/);
  assert.match(superadminTemplatesSource, /chungTuNlField/);
  assert.match(superadminTemplatesSource, /isNlFieldNamedRange\(namedRange\)/);
  assert.match(superadminTemplatesSource, /!namedRange && resolveNlFieldKey\(rawName\)/);
  assert.match(superadminTemplatesSource, /isLabelFieldNamedRange\(namedRange\)/);
  assert.match(superadminTemplatesSource, /Lưu nhãn field/);
  assert.match(superadminTemplatesSource, /Mẫu không có Named Range FIELD_/);
  assert.match(superadminTemplatesSource, /Mẫu đã ngừng dùng chỉ xem được nhãn đã lưu/);
  assert.match(superadminTemplatesSource, /role="dialog"/);
  assert.match(superadminTemplatesSource, /aria-modal="true"/);
  assert.match(superadminTemplatesSource, /setFieldLabelsModalOpen\(true\)/);
  assert.match(superadminTemplatesSource, /Nhãn field cho mẫu/);
  assert.doesNotMatch(superadminTemplatesSource, /supportsLabel/);
  assert.doesNotMatch(
    superadminTemplatesSource,
    /fieldsLoading \|\| fieldCatalogLoading/,
  );
  assert.doesNotMatch(
    superadminTemplatesSource,
    /Named Range trên mẫu[\s\S]{0,1200}Danh sách này lấy từ scalar field trên mẫu đang chọn/,
  );
});
