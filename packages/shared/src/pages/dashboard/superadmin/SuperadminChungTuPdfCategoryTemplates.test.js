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
  assert.match(superadminTemplatesSource, /labelableFields/);
  assert.match(superadminTemplatesSource, /Lưu nhãn field/);
  assert.match(superadminTemplatesSource, /Mẫu đã ngừng dùng chỉ xem được nhãn đã lưu/);
});
