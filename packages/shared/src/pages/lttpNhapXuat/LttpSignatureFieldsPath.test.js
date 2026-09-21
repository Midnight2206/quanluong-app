import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("./LttpNhapXuatPage.jsx", import.meta.url), "utf8");
const sigSource = readFileSync(
  new URL("./LttpSignatureSettingsTab.jsx", import.meta.url),
  "utf8",
);
const phieuSource = readFileSync(new URL("./LttpPhieuXuatTab.jsx", import.meta.url), "utf8");
const orderSource = readFileSync(new URL("./LttpOrderingTab.jsx", import.meta.url), "utf8");
const apiSource = readFileSync(
  new URL("../../features/lttp/api/lttpApi.js", import.meta.url),
  "utf8",
);

test("Nhập xuất mounts signature settings tab", () => {
  assert.match(pageSource, /LttpSignatureSettingsTab/);
  assert.match(pageSource, /id: "chu-ky"/);
});

test("signature settings tab posts lyDoSuDung and nhanTaiKho", () => {
  assert.match(sigSource, /extraFields\.lyDoSuDung/);
  assert.match(sigSource, /extraFields\.nhanTaiKho/);
  assert.match(sigSource, /thu_kho/);
  // useWrappedMutation returns [trigger, meta], not { mutateAsync }
  assert.match(
    sigSource,
    /\[\s*saveSettings\s*,\s*\{\s*isLoading:\s*saving\s*\}\s*\]\s*=\s*usePutLttpIssueSlipSignatureSettingsMutation/,
  );
  assert.match(sigSource, /nguoi_viet_phieu[\s\S]*locked:\s*true/);
  assert.match(sigSource, /nguoi_nhan[\s\S]*locked:\s*true/);
  assert.match(sigSource, /Chỉ xem/);
  assert.match(apiSource, /\/lttp\/issue-slip-signature-settings/);
});

test("phiếu xuất has receivedDate and signerStorekeeper", () => {
  assert.match(phieuSource, /receivedDate/);
  assert.match(phieuSource, /signerStorekeeper/);
});

test("phiếu xuất locks writer and recipient signature fields", () => {
  assert.match(phieuSource, /displayNameFromAuthUser/);
  assert.match(phieuSource, /lockedSignerWriter/);
  assert.match(phieuSource, /Cố định theo tài khoản đang làm việc/);
  assert.match(phieuSource, /Cố định theo người nhận/);
  assert.match(
    phieuSource,
    /Người viết phiếu \(ký\)[\s\S]*?readOnly[\s\S]*?Người nhận \(ký\)[\s\S]*?readOnly/,
  );
});

test("ordering capture always force-shows table before toBlob", () => {
  assert.match(orderSource, /setForceShowTableForCapture\(true\)/);
  assert.match(orderSource, /handleExportPngForZalo[\s\S]*?setForceShowTableForCapture\(true\)/);
  assert.match(orderSource, /handleOpenTablePreview[\s\S]*?setForceShowTableForCapture\(true\)/);
});
