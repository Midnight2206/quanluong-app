import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyReceiptTopUp,
  canDeclareOpeningStock,
  cktcBalanceView,
  expandReceiptRow,
  issueQty,
  level2GuaranteeRejected,
  negativeStarts,
  negativesOnDate,
  presentIssue,
  presentReceipt,
  propagateStock,
  readMoneyInWords,
  receiptQty,
} from "./kitchenPaperBook.js";
import { renderIssuePage, renderPaperDocument, renderReceiptPage } from "./kitchenPaperHtml.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/paper-t10-d01-d02.json", import.meta.url), "utf8"),
);

test("phiếu nhập 02: 32 mặt hàng, 9.870.700 đồng", () => {
  const view = presentReceipt(fixture.nhap02.map((line, index) => ({ ...line, commodityId: index + 1 })));
  assert.equal(view.itemCount, 32);
  assert.equal(view.total, 9870700);
  assert.equal(view.words, "Chín triệu tám trăm bảy mươi nghìn bảy trăm đồng");
  assert.equal(view.rows[0].tt, 1);
  assert.equal(view.rows.filter((row) => row.tt > 0).length, 32);
});

test("phiếu xuất 01: 36 mặt hàng, 3.401.800 đồng, gạo 21,9", () => {
  const view = presentIssue(fixture.xuat01.map((line, index) => ({ ...line, commodityId: index + 1 })));
  assert.equal(view.itemCount, 36);
  assert.equal(view.total, 3401800);
  assert.equal(view.words, "Ba triệu bốn trăm lẻ một nghìn tám trăm đồng");
  const gao = fixture.xuat01.find((line) => line.name.includes("Gạo"));
  assert.equal(issueQty(gao), 21.9);
});

test("số thứ tự bỏ hàng cộng bằng 0", () => {
  const view = presentReceipt([
    { trenMuaTt: 1, price: 10 },
    { trenMuaTt: 0, price: 10 },
    { dvMuaTt: 2, price: 5 },
  ]);
  assert.deepEqual(view.rows.map((row) => row.tt), [1, 0, 2]);
  assert.equal(view.itemCount, 2);
  assert.equal(view.total, 20);
});

test("tồn gạo lan từ ngày 01 sang 02", () => {
  const gaoOut = issueQty(fixture.xuat01.find((line) => line.name.includes("Gạo")));
  const gaoIn = receiptQty(fixture.nhap02.find((line) => line.name.includes("Gạo")));
  const { days } = propagateStock({
    dates: ["2026-10-01", "2026-10-02"],
    openingById: { "1": 33.1 },
    movements: {
      "2026-10-01": { out: { "1": gaoOut } },
      "2026-10-02": { in: { "1": gaoIn }, out: { "1": gaoOut } },
    },
    catalog: { "1": { name: "Gạo tẻ thường", uom: "Kg", sort: 1, price: 16000 } },
  });
  const day2 = days[1].lines[0];
  assert.equal(days[0].lines[0].close, 11.2);
  assert.equal(day2.opening, 11.2);
  assert.equal(day2.inQty, 400);
  assert.equal(day2.outQty, 21.9);
  assert.equal(day2.close, 389.3);
  assert.equal(day2.slipIn, "02");
  assert.equal(day2.slipOut, "02");
});

test("ngày bắt đầu âm là đầu chuỗi liên tục, gợi ý bằng mức âm lớn nhất", () => {
  const { days } = propagateStock({
    dates: ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"],
    movements: {
      "2026-10-01": { in: { a: 2, b: 1 } },
      "2026-10-02": { out: { a: 3, b: 1 } },
      "2026-10-03": { out: { a: 2 } },
      "2026-10-04": { in: { a: 10 } },
      "2026-10-05": { out: { a: 1, b: 4 } },
    },
    catalog: {
      a: { name: "Hành", uom: "Kg", sort: 2 },
      b: { name: "Gạo", uom: "Kg", sort: 1 },
    },
  });
  const runs = negativeStarts(days);
  const onThird = negativesOnDate(runs, "2026-10-03");
  assert.equal(onThird.length, 1);
  assert.equal(onThird[0].name, "Hành");
  assert.equal(onThird[0].startDate, "2026-10-02");
  assert.equal(onThird[0].suggestQty, 3);
  const onFifth = negativesOnDate(runs, "2026-10-05");
  const gao = onFifth.find((row) => row.name === "Gạo");
  const hanh = onFifth.find((row) => row.name === "Hành");
  assert.equal(gao.startDate, "2026-10-05");
  assert.equal(gao.suggestQty, 4);
  assert.equal(hanh, undefined);
  assert.equal(onFifth[0].startDate, "2026-10-05");
});

test("đọc số tiền bằng chữ", () => {
  assert.equal(readMoneyInWords(0), "Không đồng");
  assert.equal(readMoneyInWords(3401800), "Ba triệu bốn trăm lẻ một nghìn tám trăm đồng");
  assert.equal(readMoneyInWords(9870700), "Chín triệu tám trăm bảy mươi nghìn bảy trăm đồng");
});

test("một dòng giấy tách thành bốn nguồn phiếu nhập, không có cột thu chi", () => {
  const lines = expandReceiptRow({
    commodityId: 7,
    trenMuaTt: 0.1,
    trenTgcb: 0,
    dvMuaTt: 1.5,
    dvTgcb: 0.2,
    price: 1000,
    lineNote: "bù",
  });
  assert.equal(lines.length, 3);
  assert.equal(lines[0].lineSource, "on_guarantee");
  assert.equal(lines[0].priceKind, "market");
  assert.equal(lines[1].lineSource, "unit_self");
  assert.equal(lines[2].priceKind, "tgsx");
  assert.equal(lines[2].amount, 200);
  assert.equal("thu" in lines[0], false);
  assert.equal("chi" in lines[0], false);
});

test("cân đối thu chi chỉ là số hiển thị từ công khai tài chính và thành tiền phiếu", () => {
  const view = cktcBalanceView({
    finance: {
      subtotal: 100000,
      riceSubsidy: 5000,
      prevSurplus: 2000,
      prevShortfall: 0,
      otherIncome: { anThem: 1000, truyLinh: 0, thuKhach: 0 },
    },
    issueTotal: 90000,
  });
  assert.equal(view.thu, 106000);
  assert.equal(view.chi, 90000);
  assert.equal(view.diff, 16000);
  assert.equal(view.carried, 18000);
  assert.equal(view.surplus, true);
});

test("HTML in phiếu không chứa cân đối thu chi", () => {
  const page = renderReceiptPage({
    date: "2026-10-02",
    header: { parentName: "Tiểu đoàn", unitName: "Bếp", warehouseName: "Kho", formCode: "Mẫu 26" },
    supplierName: "Trần Văn Khánh",
    signers: ["A", "B", "C", "D"],
    lines: presentReceipt(fixture.nhap02).rows.filter((row) => row.tt),
  });
  const issue = renderIssuePage({
    date: "2026-10-01",
    header: { parentName: "Tiểu đoàn", unitName: "Đại đội", warehouseName: "Kho" },
    party: { recipientName: "Phan Văn Quang", departmentName: "Đại đội", reason: "Bảo đảm ăn tại bếp", receivePlace: "Lương thực - thực phẩm" },
    signers: ["A", "B", "C", "D"],
    lines: presentIssue(fixture.xuat01).rows.filter((row) => row.tt),
  });
  const doc = renderPaperDocument([page, issue]);
  assert.equal((doc.match(/class="paper-page"/g) || []).length, 2);
  assert.doesNotMatch(doc, /Cân đối thu chi/);
  assert.doesNotMatch(doc, /Thu trong ngày/);
  assert.match(doc, /Quyển số/);
  assert.match(doc, /PHIẾU NHẬP KHO/);
  assert.match(page, /9\.870\.700/);
  assert.match(issue, /3\.401\.800/);
});

test("cấp 2 không được đổi cột Trên bảo đảm", () => {
  const stored = [
    { commodityId: 7, lineSource: "on_guarantee", priceKind: "market", quantity: 0.4 },
    { commodityId: 7, lineSource: "unit_self", priceKind: "market", quantity: 1 },
  ];
  const same = [{ commodityId: 7, trenMuaTt: 0.4, trenTgcb: 0, dvMuaTt: 3 }];
  const changed = [{ commodityId: 7, trenMuaTt: 1.4, trenTgcb: 0 }];
  const invented = [{ commodityId: 8, trenMuaTt: 0.2, trenTgcb: 0 }];
  assert.equal(level2GuaranteeRejected(1, same, stored), false);
  assert.equal(level2GuaranteeRejected(1, changed, stored), true);
  assert.equal(level2GuaranteeRejected(1, invented, stored), true);
  assert.equal(level2GuaranteeRejected(0, changed, stored), false);
});

test("nhập bù chỉ cộng vào cột Đơn vị bảo đảm", () => {
  const next = applyReceiptTopUp({ trenMuaTt: 0.4, trenTgcb: 0.1, dvMuaTt: 1, dvTgcb: 0.2 }, 0.5);
  assert.equal(next.trenMuaTt, 0.4);
  assert.equal(next.trenTgcb, 0.1);
  assert.equal(next.dvMuaTt, 1.5);
  assert.equal(next.dvTgcb, 0.2);
});

test("tồn đầu chỉ khai khi chưa có phiếu, rồi chuyển liên tục sang tháng sau", () => {
  assert.equal(canDeclareOpeningStock(0), true);
  assert.equal(canDeclareOpeningStock(1), false);
  const { days } = propagateStock({
    dates: ["2026-09-30", "2026-10-01", "2026-10-31", "2026-11-01"],
    openingById: { "1": 33.1 },
    movements: {
      "2026-10-01": { out: { "1": 21.9 } },
    },
    catalog: { "1": { name: "Gạo tẻ thường", uom: "Kg", sort: 1, price: 16000 } },
  });
  const byDate = Object.fromEntries(days.map((day) => [day.date, day.lines[0]]));
  assert.equal(byDate["2026-09-30"].opening, 33.1);
  assert.equal(byDate["2026-09-30"].close, 33.1);
  assert.equal(byDate["2026-10-01"].opening, 33.1);
  assert.equal(byDate["2026-10-01"].close, 11.2);
  assert.equal(byDate["2026-10-31"].opening, 11.2);
  assert.equal(byDate["2026-11-01"].opening, 11.2);
  assert.equal(byDate["2026-11-01"].close, 11.2);
});

test("bản tính trên backend trùng file giao diện", () => {
  const web = readFileSync(new URL("./kitchenPaperBook.js", import.meta.url), "utf8");
  const api = readFileSync(
    new URL("../../../../../quanluong-app-be/src/modules/kitchen-books/kitchen-paper-book.js", import.meta.url),
    "utf8",
  );
  assert.equal(web, api);
});
