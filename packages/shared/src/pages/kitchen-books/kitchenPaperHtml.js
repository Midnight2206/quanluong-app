/**
 * HTML trang sổ dùng chung cho màn hình in và PDF.
 * Không có khối thu chi. Sidebar cân đối không được truyền vào đây.
 */
import {
  ISSUE_COL_WIDTHS,
  RECEIPT_COL_WIDTHS,
  STOCK_COL_WIDTHS,
  bookNoFromDate,
  columnPercents,
  escHtml,
  formatMoneyCell,
  formatQtyCell,
  readMoneyInWords,
  roundMoney,
  slipNoFromDate,
} from "./kitchenPaperBook.js";

const PAPER_CSS = `
@page { size: A4 portrait; margin: 8mm; }
html, body { margin: 0; padding: 0; background: #fff; }
.paper-page {
  width: 100%;
  box-sizing: border-box;
  color: #161616;
  font-family: "Times New Roman", Times, "Nimbus Roman", serif;
  font-size: 11px;
  page-break-after: always;
}
.paper-page:last-child { page-break-after: auto; }
.kpp-head { display: grid; grid-template-columns: 1.1fr 1.4fr 1fr; gap: 4px; margin-bottom: 6px; }
.kpp-head .center { text-align: center; }
.kpp-head .right { text-align: right; }
.kpp-title { font-size: 16px; font-weight: 700; letter-spacing: 0.04em; margin: 0; }
.kpp-sub { margin: 2px 0; }
.kpp { width: 100%; border-collapse: collapse; table-layout: fixed; }
.kpp th, .kpp td { border: 1px solid #1a1a1a; padding: 1px 2px; vertical-align: middle; word-wrap: break-word; }
.kpp th { background: #d9ead3; text-align: center; font-weight: 700; }
.kpp td.num, .kpp th.num { text-align: center; }
.kpp tfoot td { font-weight: 700; }
.kpp-sign { display: grid; grid-template-columns: repeat(4, 1fr); text-align: center; margin-top: 12px; }
.kpp-sign strong { display: block; }
.kpp-sign span { display: block; margin-top: 28px; }
.kpp-meta { display: flex; justify-content: space-between; margin-top: 8px; }
.kpp-date { text-align: right; font-style: italic; margin: 0 0 6px; }
.kitchen-paper-scroll { max-width: 100%; min-width: 0; overflow-x: auto; overscroll-behavior-x: contain; }
.paper-stage { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 12px; min-width: 0; }
.kitchen-paper { width: 210mm; box-sizing: border-box; margin: 0 auto; background: #fffef8; }
.kitchen-paper .kpp input, .kitchen-paper .kpp .kpp-name input {
  width: 100%; border: 0; border-radius: 0; background: transparent; font: inherit;
  text-align: center; padding: 0; min-width: 0; box-shadow: none;
}
.kitchen-paper .kpp .kpp-name input { text-align: left; }
.kitchen-paper tr.is-focus td { background: #fde68a; }
.kitchen-paper tr.minus td { background: #fecaca; }
.kitchen-paper td.bad { box-shadow: inset 0 0 0 2px #b91c1c; }
.paper-sidebar { width: 17rem; flex: none; border: 1px solid #d6d3d1; background: #fff; padding: 10px; font-size: 13px; }
.paper-sidebar .plus { color: #166534; font-weight: 700; }
.paper-sidebar .minus { color: #b91c1c; font-weight: 700; }
.paper-balance-toggle { display: none; }
.paper-cal { position: absolute; z-index: 30; background: #fff; border: 1px solid #d6d3d1; padding: 8px; }
@media (max-width: 1023px) {
  .paper-stage { display: block; }
  .kitchen-paper-scroll { max-width: 100%; min-width: 0; }
  .paper-sidebar { display: none; }
  .paper-sidebar.is-open {
    display: block; position: fixed; inset: 0; z-index: 80; width: auto; height: auto; overflow: auto;
    padding: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom));
  }
  .paper-balance-toggle { display: inline-flex; align-items: center; min-height: 44px; min-width: 44px; }
  .paper-sidebar button { min-height: 44px; min-width: 44px; }
  .kitchen-paper-scroll > .kitchen-paper { max-width: none; width: 210mm; }
  .paper-cal {
    position: fixed; inset: 0; z-index: 90; width: auto; height: auto; max-height: none;
    overflow: auto; border-radius: 0;
    padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
  }
  .paper-cal button { min-width: 44px; min-height: 44px; }
}
@media screen and (min-width: 1024px) {
  .kitchen-paper-shell { gap: 0.5rem; }
  .paper-stage { flex-wrap: nowrap; align-items: flex-start; gap: 6px; width: 100%; }
  .paper-stage > .kitchen-paper-scroll { flex: 1 1 0; width: auto; min-width: 0; }
  .kitchen-paper-scroll { container-type: inline-size; }
  .kitchen-paper {
    width: 100%;
    min-width: min(100%, 210mm);
    max-width: none;
    margin: 0;
    font-size: clamp(12px, 1.15cqi, 18px);
  }
  .kitchen-paper .kpp-title { font-size: clamp(18px, 2cqi, 26px); }
  .kitchen-paper table,
  .kitchen-paper .kpp { font-size: clamp(12px, 1.1cqi, 17px); }
  .kitchen-paper .kpp th,
  .kitchen-paper .kpp td { padding: clamp(1px, 0.2cqi, 4px) clamp(2px, 0.35cqi, 6px); }
  .paper-sidebar { width: 16rem; flex: 0 0 16rem; }
}
@media print {
  .no-print { display: none !important; }
  .paper-sidebar { display: none !important; }
  .paper-stage { display: block; }
  .kitchen-paper {
    width: 210mm !important;
    min-width: 0 !important;
    max-width: 210mm !important;
    margin: 0 auto !important;
    font-size: 11px !important;
  }
  .kitchen-paper .kpp-title { font-size: 16px !important; }
  .kitchen-paper table,
  .kitchen-paper .kpp { font-size: 11px !important; }
  .kitchen-paper .kpp th,
  .kitchen-paper .kpp td { padding: 1px 2px !important; }
}
`;

function rowAttrs(model, line) {
  if (!model.focusName || line.name !== model.focusName) return "";
  return ` class="is-focus" id="paper-row-focus"`;
}

function cols(widths) {
  return columnPercents(widths).map((width) => `<col style="width:${width}">`).join("");
}

function dateParts(ymd) {
  const [year, month, day] = String(ymd).split("-");
  return { year, month, day, dd: slipNoFromDate(ymd), mm: bookNoFromDate(ymd) };
}

function receiptPage(model) {
  const { day, dd, mm, year } = dateParts(model.date);
  const header = model.header || {};
  const signers = model.signers || ["", "", "", ""];
  const body = (model.lines || []).map((line) => `<tr${rowAttrs(model, line)}>
    <td class="num">${line.tt || ""}</td>
    <td class="num">${escHtml(line.code || "")}</td>
    <td>${escHtml(line.name || "")}</td>
    <td class="num">${escHtml(line.uom || "")}</td>
    <td class="num">${formatQtyCell(line.trenMuaTt)}</td>
    <td class="num">${formatQtyCell(line.trenTgcb)}</td>
    <td class="num">${formatQtyCell(line.dvMuaTt)}</td>
    <td class="num">${formatQtyCell(line.dvTgcb)}</td>
    <td class="num">${formatQtyCell(line.qty)}</td>
    <td class="num">${formatMoneyCell(line.price)}</td>
    <td class="num">${formatMoneyCell(line.amount)}</td>
    <td>${escHtml(line.lineNote || "")}</td>
  </tr>`).join("");
  return `<article class="paper-page" data-paper-page="1">
    <header class="kpp-head">
      <div>
        <div>${escHtml(header.parentName || "")}</div>
        <div><strong>${escHtml(header.unitName || "")}</strong></div>
        <div>${escHtml(header.warehouseName || "")}</div>
      </div>
      <div class="center"><h1 class="kpp-title">PHIẾU NHẬP KHO</h1></div>
      <div class="right">
        <div>${escHtml(header.formCode || "Mẫu 26: PNX-TMKH/QN25")}</div>
        <div>Số: ${escHtml(dd)}</div>
      </div>
    </header>
    <p class="kpp-sub">Có giá trị đến ngày ${escHtml(day)} tháng ${escHtml(mm)} năm ${escHtml(year)}</p>
    <p class="kpp-sub">Nhập hàng của đồng chí ${escHtml(model.supplierName || "")} theo dự trù LTTP ngày ${escHtml(day)} tháng ${escHtml(mm)} năm ${escHtml(year)}</p>
    <p class="kpp-sub">Hàng do bộ phận tiếp phẩm của Trung đoàn vận chuyển</p>
    <table class="kpp">
      <colgroup>${cols(RECEIPT_COL_WIDTHS)}</colgroup>
      <thead>
        <tr>
          <th rowspan="2">TT</th><th rowspan="2">MA</th>
          <th rowspan="2">TÊN, QUI CÁCH VẬT TƯ, SẢN PHẨM</th>
          <th rowspan="2">Đơn vị tính</th>
          <th colspan="2">TRÊN BẢO ĐẢM</th>
          <th colspan="2">ĐƠN VỊ BẢO ĐẢM</th>
          <th rowspan="2">Cộng</th><th rowspan="2">Giá lẻ</th><th rowspan="2">Thành tiền</th><th rowspan="2">Ghi chú</th>
        </tr>
        <tr><th>Mua TT</th><th>TG-CB</th><th>Mua TT</th><th>TG-CB</th></tr>
      </thead>
      <tbody>${body}</tbody>
      <tfoot><tr><td colspan="10">Cộng</td><td class="num">${formatMoneyCell(model.total)}</td><td></td></tr></tfoot>
    </table>
    <p>Tổng số mặt hàng: ${model.itemCount || 0} mặt hàng.</p>
    <p><strong>Tổng số tiền (Viết bằng chữ): ${escHtml(model.words || "")}</strong></p>
    <div class="kpp-meta"><span>Ngày giao: ${escHtml(dd)}/${escHtml(mm)}/${escHtml(year)}</span><span>Ngày nhận: ${escHtml(dd)}/${escHtml(mm)}/${escHtml(year)}</span></div>
    <div class="kpp-sign">
      <div><strong>NGƯỜI LẬP</strong><span>${escHtml(signers[0])}</span></div>
      <div><strong>NGƯỜI GIAO</strong><span>${escHtml(signers[1])}</span></div>
      <div><strong>NGƯỜI NHẬN</strong><span>${escHtml(signers[2])}</span></div>
      <div><strong>NGƯỜI DUYỆT</strong><span>${escHtml(signers[3])}</span></div>
    </div>
  </article>`;
}

function issuePage(model) {
  const { day, dd, mm, year } = dateParts(model.date);
  const header = model.header || {};
  const party = model.party || {};
  const signers = model.signers || ["", "", "", ""];
  const body = (model.lines || []).map((line) => `<tr${rowAttrs(model, line)}>
    <td class="num">${line.tt || ""}</td>
    <td class="num">${escHtml(line.code || "")}</td>
    <td>${escHtml(line.name || "")}</td>
    <td class="num">${escHtml(line.uom || "")}</td>
    <td class="num">${formatQtyCell(line.sang)}</td>
    <td class="num">${formatQtyCell(line.trua)}</td>
    <td class="num">${formatQtyCell(line.chieu)}</td>
    <td class="num">${formatQtyCell(line.qty)}</td>
    <td class="num">${formatMoneyCell(line.price)}</td>
    <td class="num">${formatMoneyCell(line.amount)}</td>
    <td>${escHtml(line.lineNote || "")}</td>
  </tr>`).join("");
  return `<article class="paper-page" data-paper-page="1">
    <header class="kpp-head">
      <div>
        <div>${escHtml(header.parentName || "")}</div>
        <div><strong>${escHtml(header.unitName || "")}</strong></div>
      </div>
      <div class="center"><h1 class="kpp-title">PHIẾU XUẤT KHO</h1></div>
      <div class="right">
        <div>Quyển số: ${escHtml(mm)}</div>
        <div>Số: ${escHtml(dd)}</div>
      </div>
    </header>
    <p class="kpp-sub">Có giá trị đến ngày ${escHtml(day)} tháng ${escHtml(mm)} năm ${escHtml(year)}</p>
    <p class="kpp-sub">Họ, tên người nhận: ${escHtml(party.recipientName || "")}</p>
    <p class="kpp-sub">Đơn vị (Bộ phận): ${escHtml(party.departmentName || "")}</p>
    <p class="kpp-sub">Lý do sử dụng: ${escHtml(party.reason || "")}</p>
    <p class="kpp-sub">Nhận tại kho: ${escHtml(party.receivePlace || "")}</p>
    <table class="kpp">
      <colgroup>${cols(ISSUE_COL_WIDTHS)}</colgroup>
      <thead>
        <tr>
          <th rowspan="2">TT</th><th rowspan="2">MA</th>
          <th rowspan="2">TÊN, QUI CÁCH VẬT TƯ, SẢN PHẨM</th>
          <th rowspan="2">Đơn vị tính</th>
          <th colspan="4">SỐ LƯỢNG</th>
          <th rowspan="2">Giá lẻ</th><th rowspan="2">Thành tiền</th><th rowspan="2">Ghi chú</th>
        </tr>
        <tr><th>Sáng</th><th>Trưa</th><th>Chiều</th><th>Tổng cộng</th></tr>
      </thead>
      <tbody>${body}</tbody>
      <tfoot><tr><td colspan="9">Cộng</td><td class="num">${formatMoneyCell(model.total)}</td><td></td></tr></tfoot>
    </table>
    <p>Tổng số mặt hàng: ${model.itemCount || 0} mặt hàng.</p>
    <p><strong>Tổng số tiền (Viết bằng chữ): ${escHtml(model.words || "")}</strong></p>
    <div class="kpp-meta"><span>Ngày giao: ${escHtml(dd)}/${escHtml(mm)}/${escHtml(year)}</span><span>Ngày nhận: ${escHtml(dd)}/${escHtml(mm)}/${escHtml(year)}</span></div>
    <div class="kpp-sign">
      <div><strong>NGƯỜI VIẾT PHIẾU</strong><span>${escHtml(signers[0])}</span></div>
      <div><strong>NGƯỜI NHẬN</strong><span>${escHtml(signers[1])}</span></div>
      <div><strong>THỦ KHO</strong><span>${escHtml(signers[2])}</span></div>
      <div><strong>NGƯỜI DUYỆT</strong><span>${escHtml(signers[3])}</span></div>
    </div>
  </article>`;
}

function stockPage(model) {
  const { day, mm, year } = dateParts(model.date);
  const body = (model.lines || []).map((line) => `<tr${rowAttrs(model, line)}>
    <td class="num">${escHtml(line.slipIn || "")}</td>
    <td class="num">${escHtml(line.slipOut || "")}</td>
    <td>${escHtml(line.name || "")}</td>
    <td class="num">${escHtml(line.uom || "")}</td>
    <td class="num">${formatQtyCell(line.opening)}</td>
    <td class="num">${formatQtyCell(line.inQty)}</td>
    <td class="num">${formatQtyCell(line.outQty)}</td>
    <td class="num">${formatQtyCell(line.close)}</td>
    <td></td>
  </tr>`).join("");
  return `<article class="paper-page" data-paper-page="1">
    <p class="kpp-date">Ngày ${escHtml(day)} tháng ${escHtml(mm)} năm ${escHtml(year)}</p>
    <table class="kpp">
      <colgroup>${cols(STOCK_COL_WIDTHS)}</colgroup>
      <thead>
        <tr>
          <th colspan="2">SỐ PHIẾU</th>
          <th rowspan="2">DANH MỤC</th>
          <th rowspan="2">ĐVT</th>
          <th rowspan="2">Tồn ngày trước chuyển sang</th>
          <th rowspan="2">Nhập</th>
          <th rowspan="2">Xuất</th>
          <th rowspan="2">Tồn</th>
          <th rowspan="2">GHI CHÚ</th>
        </tr>
        <tr><th>NHẬP</th><th>XUẤT</th></tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  </article>`;
}

function renderPaperDocument(pages) {
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Sổ</title><style>${PAPER_CSS}</style></head><body>${pages.join("")}</body></html>`;
}

function withTotals(model) {
  const lines = model.lines || [];
  const total = model.total ?? lines.reduce((sum, line) => sum + roundMoney(line.amount), 0);
  return {
    ...model,
    lines,
    total,
    itemCount: model.itemCount ?? lines.filter((line) => line.tt).length,
    words: model.words || readMoneyInWords(total),
  };
}

function renderReceiptPage(model) {
  return receiptPage(withTotals(model));
}

function renderIssuePage(model) {
  return issuePage(withTotals(model));
}

function renderStockPage(model) {
  return stockPage(model);
}

export {
  PAPER_CSS,
  renderIssuePage,
  renderPaperDocument,
  renderReceiptPage,
  renderStockPage,
};
