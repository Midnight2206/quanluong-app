import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { reviewDraft } from "./ledgerDraftReview.js";

const here = dirname(fileURLToPath(import.meta.url));

test("bỏ bản nháp không tạo lệnh ghi", () => {
  const decision = reviewDraft("reject", [
    { name: "Mực", savable: true, kind: "self_supply", source: "I", qty: 5 },
  ]);
  assert.equal(decision.save, false);
  assert.deepEqual(decision.slipLines, []);
});

test("chấp nhận chỉ đưa hàng đơn vị vào phiếu nhập", () => {
  const decision = reviewDraft("accept", [
    { name: "Mực", savable: true, kind: "self_supply", source: "I", qty: 5, commodityId: 1 },
    { name: "Thịt", savable: true, kind: "self_supply", source: "G", qty: 1, commodityId: 2 },
    { name: "Gạo", savable: true, kind: "rice", source: "J", qty: 2, commodityId: 4 },
    { name: "Xuất ăn", savable: true, kind: "meal_out", source: "N", qty: 1, commodityId: 5 },
    { name: "Sữa", savable: false, kind: "self_supply", source: "J", qty: 3, commodityId: 3 },
  ]);
  assert.equal(decision.save, true);
  assert.deepEqual(decision.slipLines.map((line) => [line.name, line.priceKind]), [
    ["Mực", "market"],
    ["Gạo", "tgsx"],
  ]);
});

test("màn sổ mở mức ăn, quân số và trợ lý bằng nút, bản nháp có nút bỏ", () => {
  const tab = readFileSync(join(here, "KitchenSoNhapXuatLttpTab.jsx"), "utf8");
  const assistant = readFileSync(join(here, "KitchenLedgerAssistant.jsx"), "utf8");
  assert.match(tab, /title="Cài đặt mức ăn"/);
  assert.match(tab, /title="Nhập quân số"/);
  assert.match(tab, /onClick=\{\(\) => setPanel\("meals"\)\}/);
  assert.match(tab, /onClick=\{\(\) => setPanel\("headcount"\)\}/);
  assert.match(tab, /onClick=\{\(\) => setPanel\("assistant"\)\}/);
  const paperAt = tab.indexOf("ledger-day-slide ledger-paper");
  const mealsAt = tab.indexOf('setPanel("meals")');
  assert.ok(paperAt > mealsAt && paperAt > 0);
  assert.match(tab, /fixed inset-0 z-\[70\]/);
  assert.match(assistant, /Bỏ đề xuất/);
  assert.match(assistant, /reviewDraft\("accept"/);
  assert.doesNotMatch(assistant, /planRations/);
  assert.doesNotMatch(tab, /Nhập số lượng/);
  assert.doesNotMatch(tab, /function linesFrom/);
  assert.match(tab, /phieu-nhap-kho/);
  assert.match(tab, /lttp-nhap-xuat/);
  assert.match(tab, /Sửa phiếu nhập/);
  assert.match(assistant, /Ghi vào phiếu nhập/);
  assert.doesNotMatch(tab, /Sổ nháp/);
  assert.doesNotMatch(assistant, /Sổ nháp/);
  assert.doesNotMatch(assistant, /Nhập số lượng/);
});
