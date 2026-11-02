/**
 * Chụp 3 tab sổ giấy và sổ nhập xuất cũ ở 375, 414, 768, 1024, 1440.
 * Server web phải đang chạy ở :3000.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const outDir = "/opt/cursor/artifacts/kitchen-paper/viewports";
mkdirSync(outDir, { recursive: true });

const WIDTHS = [375, 414, 768, 1024, 1440];
const TABS = [
  ["nhap", "phieu-nhap-kho", "2026-10-02"],
  ["xuat", "phieu-xuat-kho", "2026-10-01"],
  ["so", "so-theo-doi-lttp", "2026-10-02"],
  ["so-cu", "so-nhap-xuat-lttp", "2026-10-02"],
];

const USER = {
  id: 1,
  username: "beptruong",
  email: "visual@example.com",
  emailVerifiedAt: "2026-01-01T00:00:00.000Z",
  profile: { fullName: "Nguyễn Văn A" },
  unit: { id: 1, name: "Bếp Đại đội 5", path: "/1/", depth: 1 },
  type: { id: 2, name: "admin" },
  permissions: [
    "kitchenBooks.access", "kitchenBooks.view", "kitchenBooks.save", "kitchenBooks.export",
    "mealRoster.access", "lttp.commodities.read", "lttp.prices.read", "units.read",
  ].map((code) => ({ code })),
};

const LINES = [
  { commodityId: 1, code: "", name: "Gạo tẻ thường", uom: "Kg", trenMuaTt: 400, trenTgcb: 0, dvMuaTt: 0, dvTgcb: 0, price: 16000, lineNote: "" },
  { commodityId: 2, code: "", name: "Hành tươi", uom: "Kg", trenMuaTt: 0.1, trenTgcb: 0, dvMuaTt: 0, dvTgcb: 0, price: 33000, lineNote: "" },
];
const ISSUE = [
  { commodityId: 1, code: "", name: "Gạo tẻ thường", uom: "Kg", sang: 4.4, trua: 8.8, chieu: 8.7, price: 16000, lineNote: "" },
  { commodityId: 2, code: "", name: "Hành tươi", uom: "Kg", sang: 0, trua: 0.1, chieu: 0, price: 33000, lineNote: "" },
];

function json(route, data) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, data }),
  });
}

const findings = [];

function note(width, tab, message) {
  findings.push({ width, tab, message });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "vi-VN" });
await context.addCookies([{ name: "ql.at", value: "visual-session", url: "http://127.0.0.1:3000" }]);
const page = await context.newPage();
await page.route("**/api/**", (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path.includes("/auth/current-user")) return json(route, USER);
  if (path.includes("/units")) return json(route, [{ id: 1, name: "Bếp Đại đội 5", path: "/1/", depth: 1 }]);
  if (path.includes("/kitchen-books/paper/receipt")) {
    return json(route, {
      date: "2026-10-02",
      header: { parentName: "TIỂU ĐOÀN KTHCSB", unitName: "BẾP ĐẠI ĐỘI 5 VỆ BINH", warehouseName: "KHO LTTP", formCode: "Mẫu 26: PNX-TMKH/QN25" },
      supplierName: "Trần Văn Khánh",
      signers: ["", "", "", ""],
      lines: LINES,
      canEditGuarantee: false,
      itemCount: 2,
      total: 6403300,
      words: "Sáu triệu bốn trăm lẻ ba nghìn ba trăm đồng",
    });
  }
  if (path.includes("/kitchen-books/paper/issue")) {
    return json(route, {
      date: "2026-10-01",
      header: { parentName: "TIỂU ĐOÀN KTHCSB", unitName: "ĐẠI ĐỘI 5 VỆ BINH" },
      recipientName: "Phan Văn Quang",
      departmentName: "Đại đội 5 Vệ Binh",
      reason: "Bảo đảm ăn tại bếp",
      receivePlace: "Lương thực - thực phẩm",
      signers: ["", "", "", ""],
      lines: ISSUE,
      itemCount: 2,
      total: 353700,
      words: "",
    });
  }
  if (path.includes("/kitchen-books/paper/stock")) {
    return json(route, {
      month: "2026-10",
      canDeclareOpening: false,
      openingLines: [],
      markers: { "2026-10-01": { hasData: true, negative: false }, "2026-10-02": { hasData: true, negative: true } },
      days: [{
        date: "2026-10-02",
        negativeCount: 1,
        lines: [{
          commodityId: 1, name: "Gạo tẻ thường", uom: "Kg", slipIn: "02", slipOut: "02",
          opening: 11.2, inQty: 400, outQty: 21.9, close: 389.3, negative: false,
        }],
      }],
      negatives: [{ commodityId: 1, name: "Hành", uom: "Kg", startDate: "2026-10-02", suggestQty: 0.2, dates: ["2026-10-02"] }],
    });
  }
  if (path.includes("/kitchen-books/ledger")) {
    return json(route, {
      status: "draft",
      canEdit: true,
      canLock: false,
      canExport: true,
      slipCount: 1,
      lines: [{ tt: 1, name: "Gạo tẻ", uom: "kg", unitPrice: 18000, openingQty: 12 }],
      structure: {
        dateLine: "Ngày 02 tháng 10 năm 2026",
        rows: [{ tt: 1, name: "Gạo tẻ", uom: "kg", unitPrice: 18000, openingQty: 12, openingAmount: 216000 }],
        totals: { openingAmount: 216000 },
        financeLines: [{ label: "Thu", amount: "1000" }],
        finance: { subtotal: 3200000, prevSurplus: 0, prevShortfall: 0, riceSubsidy: 0, otherIncome: {} },
        headcount: { meals: [], extras: [] },
      },
      finance: { subtotal: 3200000, prevSurplus: 0, prevShortfall: 0, riceSubsidy: 0, otherIncome: { anThem: 0, truyLinh: 0, thuKhach: 0 } },
      settings: { signatures: {} },
      mealRates: {},
      warnings: [],
      blockers: [],
      manualEntryCount: 0,
      priceTable: { effectiveDate: "2026-10-01" },
      headcount: { levels: [], extras: {} },
    });
  }
  if (path.includes("/lttp/commodities")) {
    return json(route, [
      { id: 1, name: "Gạo tẻ thường", code: "GAO", measureUnit: "Kg" },
      { id: 2, name: "Hành tươi", code: "HANH", measureUnit: "Kg" },
    ]);
  }
  if (path.includes("/lttp/prices")) return json(route, { items: [] });
  return json(route, []);
});
await page.route("**/socket.io/**", (route) => route.abort());

for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 900 });
  for (const [key, tab, date] of TABS) {
    await page.goto(`http://127.0.0.1:3000/so-sach-bep-an?tab=${tab}&date=${date}&ngay=${date}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.locator(".kpp-title, .ledger-paper table").first().waitFor({ timeout: 30000 });
    await page.addStyleTag({ content: "nextjs-portal,[data-nextjs-toast]{display:none !important}" });
    const file = `${outDir}/${key}-${width}.png`;
    await page.screenshot({ path: file, fullPage: false });
    const metrics = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const paper = document.querySelector(".kitchen-paper, .ledger-paper");
      const scroll = document.querySelector(".kitchen-paper-scroll");
      const sidebar = document.querySelector(".paper-sidebar");
      const toggle = document.querySelector(".paper-balance-toggle");
      const sideStyle = sidebar ? getComputedStyle(sidebar) : null;
      const toggleStyle = toggle ? getComputedStyle(toggle) : null;
      return {
        overflow: document.documentElement.scrollWidth - vw,
        paperW: paper ? Math.round(paper.getBoundingClientRect().width) : 0,
        scrollW: scroll ? Math.round(scroll.getBoundingClientRect().width) : 0,
        sidebarDisplay: sideStyle?.display || null,
        toggleDisplay: toggleStyle?.display || null,
      };
    });
    if (metrics.overflow > 2) note(width, key, `trang tràn ngang ${metrics.overflow}px`);
    if (key !== "so-cu" && width <= 768 && metrics.paperW > 0 && metrics.paperW < 700) {
      note(width, key, `trang giấy bị co còn ${metrics.paperW}px`);
    }
    if (key !== "so-cu" && width < 1024 && metrics.sidebarDisplay && metrics.sidebarDisplay !== "none") {
      note(width, key, `sidebar không thành drawer (${metrics.sidebarDisplay})`);
    }
    if ((key === "nhap" || key === "xuat") && width < 1024 && metrics.toggleDisplay === "none") {
      note(width, key, "nút mở drawer bị ẩn");
    }
    if ((key === "nhap" || key === "xuat") && width >= 1024 && metrics.sidebarDisplay === "none") {
      note(width, key, "sidebar desktop bị ẩn");
    }
  }

  if (width === 375) {
    await page.goto("http://127.0.0.1:3000/so-sach-bep-an?tab=phieu-nhap-kho&date=2026-10-02&ngay=2026-10-02", { waitUntil: "domcontentloaded" });
    await page.locator(".kpp-title").waitFor({ timeout: 30000 });
    const dateBtn = page.getByRole("button", { name: /2026/ });
    if (await dateBtn.count()) await dateBtn.first().click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${outDir}/nhap-375-lich.png` });
    const cal = await page.evaluate(() => {
      const box = document.querySelector(".paper-cal")?.getBoundingClientRect();
      const btn = document.querySelector(".paper-cal button");
      const b = btn?.getBoundingClientRect();
      return {
        full: box ? box.width >= document.documentElement.clientWidth - 2 && box.height >= document.documentElement.clientHeight - 2 : false,
        bw: b ? Math.round(b.width) : 0,
        bh: b ? Math.round(b.height) : 0,
      };
    });
    if (!cal.full) note(375, "lich", "lịch chưa full màn hình");
    if (cal.bw < 44 || cal.bh < 44) note(375, "lich", `ô ngày ${cal.bw}x${cal.bh}`);

    await page.goto("http://127.0.0.1:3000/so-sach-bep-an?tab=phieu-xuat-kho&date=2026-10-01&ngay=2026-10-01", { waitUntil: "domcontentloaded" });
    await page.locator(".kpp-title").waitFor({ timeout: 30000 });
    const open = page.getByRole("button", { name: "Cân đối thu chi" });
    if (await open.count()) await open.first().click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${outDir}/xuat-375-drawer.png` });
    const drawer = await page.evaluate(() => {
      const el = document.querySelector(".paper-sidebar.is-open");
      if (!el) return null;
      const box = el.getBoundingClientRect();
      return { w: Math.round(box.width), h: Math.round(box.height), vw: document.documentElement.clientWidth, vh: document.documentElement.clientHeight };
    });
    if (!drawer || drawer.w < drawer.vw - 2) note(375, "xuat", "drawer cân đối chưa phủ màn hình");

    await page.goto("http://127.0.0.1:3000/so-sach-bep-an?tab=phieu-nhap-kho&date=2026-10-02&ngay=2026-10-02", { waitUntil: "domcontentloaded" });
    await page.locator(".kpp-title").waitFor({ timeout: 30000 });
    const ton = page.getByRole("button", { name: "Tồn chuyển hôm sau" });
    if (await ton.count()) await ton.first().click();
    await page.screenshot({ path: `${outDir}/nhap-375-ton.png` });
  }
}

writeFileSync(`${outDir}/findings.json`, JSON.stringify(findings, null, 2));
await browser.close();
if (findings.length) {
  console.error(JSON.stringify(findings, null, 2));
  process.exit(1);
}
console.log("viewports ok", outDir);
