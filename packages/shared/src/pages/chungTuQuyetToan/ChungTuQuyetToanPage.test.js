import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(
  new URL("./ChungTuQuyetToanPage.jsx", import.meta.url),
  "utf8",
);
const categorySource = readFileSync(
  new URL("./ChungTuCategoryWorkspace.jsx", import.meta.url),
  "utf8",
);
const summarySource = readFileSync(
  new URL("./ChungTuSummaryWorkspace.jsx", import.meta.url),
  "utf8",
);
const mappingSource = readFileSync(
  new URL("./ChungTuTemplateMappingPanel.jsx", import.meta.url),
  "utf8",
);
const signatureSettingsSource = readFileSync(
  new URL("./ChungTuSignatureSettingsWorkspace.jsx", import.meta.url),
  "utf8",
);
const apiSource = readFileSync(
  new URL("../../features/chung-tu-quyet-toan/api/chungTuPdfApi.js", import.meta.url),
  "utf8",
);
const queryKeysSource = readFileSync(
  new URL("../../app/query/queryKeys.js", import.meta.url),
  "utf8",
);

test("decision documents use a compact two-level sticky stack", () => {
  assert.doesNotMatch(
    pageSource,
    /<h1[^>]*>\s*Chứng từ quyết toán\s*<\/h1>/,
  );
  assert.match(pageSource, /stickyTabListLevel=\{0\}/);
  assert.doesNotMatch(pageSource, /shadow-soft overflow-hidden/);
  assert.match(categorySource, /stickyTabListLevel=\{1\}/);
  assert.match(summarySource, /stickyLevel=\{2\}/);
  assert.match(mappingSource, /stickyLevel=\{2\}/);
  assert.doesNotMatch(
    `${summarySource}\n${mappingSource}`,
    /stickyLevel=\{3\}/,
  );
});

test("BKMH signature workspace shows auto-resolved header info instead of manual inputs", () => {
  assert.match(apiSource, /useChungTuBkmhHeaderSettingsQuery/);
  assert.match(apiSource, /useUpsertChungTuBkmhHeaderSettingsMutation/);
  assert.match(apiSource, /\/chungtuquyettoan\/bkmh-header-settings/);
  assert.match(queryKeysSource, /bkmhHeaderSettings:\s*\(categoryKey\)/);
  assert.match(signatureSettingsSource, /categoryKey === "bang-ke-mua-hang"/);
  assert.match(
    signatureSettingsSource,
    /Họ tên và bộ phận người mua sẽ được lấy tự động từ cài đặt người mua của đơn vị khi xuất PDF/,
  );
  assert.doesNotMatch(signatureSettingsSource, /registerBkmhHeader\("hoTenNguoiMua"\)/);
  assert.doesNotMatch(signatureSettingsSource, /registerBkmhHeader\("boPhan"\)/);
});

test("PXK signature workspace saves xuatTaiKho + diaDiem and locks thu_kho + nguoi_nhan slots", () => {
  assert.match(signatureSettingsSource, /categoryKey === "phieu-xuat-kho"/);
  assert.match(signatureSettingsSource, /key:\s*"thu_kho"/);
  assert.match(signatureSettingsSource, /key:\s*"nguoi_nhan"/);
  assert.match(signatureSettingsSource, /register\("extraFields\.xuatTaiKho"\)/);
  assert.match(signatureSettingsSource, /register\("extraFields\.diaDiem"\)/);
  assert.match(signatureSettingsSource, /FIELD_xuat_tai_kho/);
  assert.match(signatureSettingsSource, /FIELD_dia_diem/);
  assert.match(signatureSettingsSource, /xuatTaiKho/);
  assert.match(signatureSettingsSource, /diaDiem/);
  assert.match(signatureSettingsSource, /ensurePxkSignatureBlock/);
  assert.match(signatureSettingsSource, /slotValue\?\.locked/);
  assert.doesNotMatch(
    signatureSettingsSource,
    /disabled=\{!canWrite \|\| saving \|\| slotValue\?\.source !== "static" \|\| slotValue\?\.locked\}/,
  );
  assert.match(
    signatureSettingsSource,
    /slotValue\?\.locked && slotValue\?\.key !== "thu_kho"/,
  );
});

test("PNK signature workspace saves lyDoNhapKho + nhapTaiKho and locks nguoi_giao slot", () => {
  assert.match(apiSource, /extraFields/);
  assert.match(signatureSettingsSource, /categoryKey === "phieu-nhap-kho"/);
  assert.match(signatureSettingsSource, /Lý do nhập kho/);
  assert.match(signatureSettingsSource, /register\("extraFields\.lyDoNhapKho"\)/);
  assert.match(signatureSettingsSource, /FIELD_ly_do_nhap_kho/);
  assert.match(signatureSettingsSource, /Nhập tại kho/);
  assert.match(signatureSettingsSource, /register\("extraFields\.nhapTaiKho"\)/);
  assert.match(signatureSettingsSource, /FIELD_nhap_tai_kho/);
  assert.match(signatureSettingsSource, /key:\s*"nguoi_giao"/);
  assert.match(signatureSettingsSource, /label:\s*"NGƯỜI GIAO"/);
  assert.match(signatureSettingsSource, /locked:\s*true/);
  assert.match(signatureSettingsSource, /slotValue\?\.locked/);
});
