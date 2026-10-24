import assert from "node:assert/strict";
import test from "node:test";
import {
  briefAnomalies,
  headcountLike,
  proposeSettings,
  questionDate,
  renderTool,
  routeIntent,
  routeQuestion,
  settingsPatch,
} from "./kitchen-ledger-assistant-core.js";

test("câu mua ngoài là bản ghi hàng, không phải hỏi sổ", () => {
  assert.equal(routeIntent("mua ngoài 5kg mực 180k, sữa 40 hộp"), "movement");
});

test("quy tắc chữ ra đề nghị cấu hình, phần còn lại chỉ là ghi chú", () => {
  assert.equal(routeIntent("Từ nay ngưỡng thừa thiếu 10.000"), "rule");
  const proposals = proposeSettings("Từ nay ngưỡng 10k. Tiền đã sử dụng theo xuất ăn ΣO. Lễ tết chỉ trưa. Sữa mua theo ngày bay.");
  assert.deepEqual(settingsPatch(proposals), {
    balanceWarnThreshold: 10000,
    spentBasis: "meal_out",
    holidayLunchOnly: true,
    milk: { mode: "purchase" },
  });
  assert.deepEqual(proposeSettings("Bếp này không chiên dầu vào thứ hai."), []);
});

test("bất thường đọc từ sổ đã tính", () => {
  const items = briefAnomalies({
    blockers: [{ code: "missing_price", message: "Thiếu bảng giá." }],
    warnings: [{ code: "negative_stock", message: "Mỳ chính tồn âm." }],
    finance: { balanceWarn: true, surplus: "9260", shortfall: "0", balanceWarnThreshold: "20000" },
    headcount: { levels: [{ dailyAmount: 72000, sang: 140, trua: 97, chieu: 97 }] },
    previousHeadcount: { levels: [{ dailyAmount: 72000, sang: 90, trua: 97, chieu: 97 }] },
  });
  assert.ok(items.some((row) => row.code === "missing_price"));
  assert.ok(items.some((row) => row.code === "negative_stock"));
  assert.match(items.find((row) => row.code === "balance_threshold").message, /9\.260/);
  assert.match(items.find((row) => row.code === "headcount_shift").message, /140/);
});

test("vì sao ngày 24 thừa 9.260 đọc khối thu chi, không tính lại", () => {
  assert.equal(routeIntent("tại sao ngày 24 thừa 9.260"), "question");
  assert.equal(questionDate("tại sao ngày 24 thừa 9.260", "2026-10-21"), "2026-10-24");
  assert.deepEqual(routeQuestion("tại sao ngày 24 thừa 9.260", ["Gạo"]), { tool: "explain_finance" });
  const text = renderTool("explain_finance", {
    date: "2026-10-24",
    ledgerBlocked: false,
    finance: {
      totalIncome: "10000000",
      spent: "9990740",
      spentBasis: "total_out",
      prevSurplus: "0",
      prevShortfall: "0",
      surplus: "9260",
      shortfall: "0",
    },
  });
  assert.match(text, /2026-10-24/);
  assert.match(text, /9\.260/);
  assert.match(text, /cộng xuất/);
});

test("tồn một mặt hàng kèm lô FIFO", () => {
  const text = renderTool("item_stock", {
    date: "2026-10-24",
    ledgerBlocked: false,
    lines: [{
      name: "Mực ống",
      openingQty: "1",
      inG: "0",
      inH: "0",
      inI: "5",
      inJ: "0",
      mealQty: "2",
      otherQty: "0",
      closingQty: "4",
      uom: "Kg",
      unitPrice: "180000",
    }],
    closingLots: [{ name: "Mực ống", qty: "4", unitPrice: "180000", receivedDate: "2026-10-24" }],
  }, "Mực ống");
  assert.match(text, /còn 4 Kg/);
  assert.match(text, /Lô FIFO/);
  assert.match(text, /180\.000/);
});

test("cân đối không bị hiểu là câu tính sổ", () => {
  assert.equal(routeIntent("cân đối âm kho giúp"), "question");
});

test("như 17/10 trỏ ngày trên sổ", () => {
  assert.equal(routeIntent("như 17/10"), "headcount");
  assert.deepEqual(headcountLike("22/10 như 17/10", "2026-10-21"), {
    ref: "2026-10-17",
    target: "2026-10-22",
  });
});
