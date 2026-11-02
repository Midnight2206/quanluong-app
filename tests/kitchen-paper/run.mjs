/**
 * Kiểm tra 3 trang sổ giấy: một trang, PDF A4 không cắt cột,
 * deep-link tô dòng, sidebar cân đối không nằm trong PDF.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import {
  cktcBalanceView,
  presentIssue,
  presentReceipt,
} from "../../packages/shared/src/pages/kitchen-books/kitchenPaperBook.js";
import {
  renderIssuePage,
  renderPaperDocument,
  renderReceiptPage,
  renderStockPage,
} from "../../packages/shared/src/pages/kitchen-books/kitchenPaperHtml.js";

const fixture = JSON.parse(readFileSync(
  new URL("../../packages/shared/src/pages/kitchen-books/fixtures/paper-t10-d01-d02.json", import.meta.url),
  "utf8",
));

const outDir = "/opt/cursor/artifacts/kitchen-paper";
mkdirSync(outDir, { recursive: true });

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const receiptView = presentReceipt(fixture.nhap02);
const issueView = presentIssue(fixture.xuat01);
const balance = cktcBalanceView({
  finance: {
    subtotal: 3200000,
    prevSurplus: 10000,
    prevShortfall: 0,
    riceSubsidy: 0,
    otherIncome: { anThem: 0, truyLinh: 0, thuKhach: 0 },
  },
  issueTotal: issueView.total,
});

const pages = {
  nhap: renderPaperDocument([renderReceiptPage({
    date: "2026-10-02",
    header: { parentName: "TIỂU ĐOÀN KTHCSB", unitName: "BẾP ĐẠI ĐỘI 5 VỆ BINH", warehouseName: "KHO LTTP", formCode: "Mẫu 26: PNX-TMKH/QN25" },
    supplierName: "Trần Văn Khánh",
    signers: ["", "", "", ""],
    focusName: "Gạo tẻ thường",
    lines: receiptView.rows.filter((row) => row.tt),
    total: receiptView.total,
    itemCount: receiptView.itemCount,
    words: receiptView.words,
  })]),
  xuat: renderPaperDocument([renderIssuePage({
    date: "2026-10-01",
    header: { parentName: "TIỂU ĐOÀN KTHCSB", unitName: "ĐẠI ĐỘI 5 VỆ BINH" },
    party: {
      recipientName: "Phan Văn Quang",
      departmentName: "Đại đội 5 Vệ Binh",
      reason: "Bảo đảm ăn tại bếp",
      receivePlace: "Lương thực - thực phẩm",
    },
    signers: ["", "", "", ""],
    lines: issueView.rows.filter((row) => row.tt),
    total: issueView.total,
    itemCount: issueView.itemCount,
    words: issueView.words,
  })]),
  so: renderPaperDocument([renderStockPage({
    date: "2026-10-02",
    focusName: "Gạo tẻ thường",
    lines: [{
      name: "Gạo tẻ thường",
      uom: "Kg",
      slipIn: "02",
      slipOut: "02",
      opening: 11.2,
      inQty: 400,
      outQty: 21.9,
      close: 389.3,
    }],
  })]),
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });

for (const [name, html] of Object.entries(pages)) {
  assert(!html.includes("Cân đối thu chi"), `${name} PDF html contains balance sidebar`);
  assert(!html.includes("Thu trong ngày"), `${name} PDF html contains income line`);
  await page.setContent(html, { waitUntil: "load" });
  const count = await page.locator(".paper-page").count();
  assert(count === 1, `${name} shows ${count} pages`);
  const paper = await page.locator(".paper-page").boundingBox();
  const cells = page.locator(".kpp th, .kpp td");
  const n = await cells.count();
  for (let i = 0; i < n; i += 1) {
    const box = await cells.nth(i).boundingBox();
    if (!box || !paper) continue;
    assert(box.x + box.width <= paper.x + paper.width + 1, `${name} column ${i} is cut`);
  }
  if (name === "xuat") {
    assert(await page.getByText("Quyển số:").count() === 1, "missing book number");
    assert(await page.getByText("Số: 01").count() === 1, "missing slip number");
    const signs = await page.locator(".kpp-sign").boundingBox();
    assert(signs && signs.y + signs.height <= paper.y + paper.height + 1, "signatures overflow the page");
  }
  if (name === "nhap") {
    const focus = page.locator("#paper-row-focus");
    assert(await focus.count() === 1, "deep link did not mark the row");
    assert((await focus.innerText()).includes("Gạo tẻ thường"), "focused row is not gạo");
    assert((await page.locator(".paper-page").innerText()).includes("Số: 02"), "deep link day is not 02");
  }
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
  const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "8mm", bottom: "8mm", left: "8mm", right: "8mm" } });
  writeFileSync(`${outDir}/${name}.pdf`, pdf);
  const text = pdf.toString("latin1");
  const box = text.match(/\/MediaBox\s*\[\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\]/);
  assert(box, `${name} pdf has no MediaBox`);
  const width = Number(box[3]) - Number(box[1]);
  const height = Number(box[4]) - Number(box[2]);
  assert(Math.abs(width - 595.28) < 2, `${name} pdf width ${width} is not A4`);
  assert(Math.abs(height - 841.89) < 2, `${name} pdf height ${height} is not A4`);
  assert(!text.includes("Cân đối thu chi"), `${name} pdf contains balance text`);
}

await page.setContent(`
  <style>body { font-family: sans-serif; display: flex; }</style>
  <article class="paper-page"><h1>PHIẾU XUẤT KHO</h1><p>Quyển số: 10</p></article>
  <aside id="balance">
    <h2>Cân đối thu chi</h2>
    <p>Thu trong ngày: ${balance.thu.toLocaleString("vi-VN")}</p>
    <p>Chi trong ngày: ${balance.chi.toLocaleString("vi-VN")}</p>
    <p>Chênh lệch ngày: ${balance.diff.toLocaleString("vi-VN")}</p>
  </aside>
  <a id="back" href="/so-sach-bep-an?tab=phieu-nhap-kho&ngay=2026-10-02&mathang=1&bu=3">Về phiếu nhập ngày bắt đầu âm</a>
`, { waitUntil: "load" });
const aside = await page.locator("#balance").innerText();
assert(aside.includes(balance.thu.toLocaleString("vi-VN")), "sidebar thu does not match cktc");
assert(aside.includes(balance.chi.toLocaleString("vi-VN")), "sidebar chi does not match issue total");
assert(balance.chi === 3401800, "issue total drifted");
const href = await page.locator("#back").getAttribute("href");
assert(href.includes("ngay=2026-10-02"), "deep link date");
assert(href.includes("mathang=1"), "deep link item");
assert(href.includes("tab=phieu-nhap-kho"), "deep link tab");
await page.screenshot({ path: `${outDir}/can-doi.png` });

await browser.close();
console.log("kitchen paper playwright ok", outDir);
