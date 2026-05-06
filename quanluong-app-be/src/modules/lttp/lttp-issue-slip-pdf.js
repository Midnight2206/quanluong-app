import PDFDocument from "pdfkit";
import path from "node:path";

const PAGE_SIZE = "A4";
const DEFAULT_PAGE_MARGIN = 42; // ~1.5cm
const TABLE_HEADER_HEIGHT = 28;
const TABLE_HEADER_ROW2_HEIGHT = 34;
const TABLE_FOOTER_ROW_HEIGHT = 20;
const TABLE_CARRY_ROW_HEIGHT = 20;
const BASE_ROW_HEIGHT = 20;
/** Khối ký + phần sau "Tổng thành tiền" (ước lượng an toàn cho paginate) */
const SIGNATURE_BLOCK_HEIGHT = 160;
/**
 * Chiều cao phần cố định trước dòng dữ liệu bảng — khớp drawHeaderBlock + drawTableHeader:
 * title block ~136*scale + thead (28+34)*scale; thêm đệm nhỏ cho sai lệch đo.
 */
const FIRST_PAGE_FIXED_HEIGHT = 204;
/** Trang từ thứ 2: chỉ thead (+ dòng Mang sang nếu có). */
const NEXT_PAGE_FIXED_HEIGHT = 90;
const FONT_REGULAR = path.resolve(process.cwd(), "assets/fonts/Times New Roman.ttf");
const FONT_BOLD = path.resolve(process.cwd(), "assets/fonts/Times New Roman Bold.ttf");

function readGroup(n) {
  const d = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const c = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  const parts = [];
  if (c > 0) parts.push(`${d[c]} trăm`);
  if (t > 0) {
    if (t === 1) parts.push("mười");
    else parts.push(`${d[t]} mươi`);
  } else if (c > 0 && u > 0) {
    parts.push("lẻ");
  }
  if (u > 0) {
    if (u === 1 && t > 0 && t !== 1) parts.push("mốt");
    else if (u === 5 && t > 0) parts.push("lăm");
    else parts.push(d[u]);
  } else if (c === 0 && t === 0 && n === 0) {
    return d[0];
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("vi-VN");
}

function formatQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(ymd) {
  if (!ymd) return "";
  const [y, m, d] = String(ymd).split("-").map(Number);
  if (!y || !m || !d) return String(ymd);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function formatIssueSlipPrintDate(ymd) {
  if (!ymd || typeof ymd !== "string") return "";
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return "";
  return `Ngày ${String(d).padStart(2, "0")} tháng ${mo} năm ${y}`;
}

function vndToVietnameseDocumentLine(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) return "";
  if (n === 0) return "Không đồng";
  const cap = (s) => (s ? s.charAt(0).toLocaleUpperCase("vi") + s.slice(1) : s);
  let r = n;
  const ty = Math.floor(r / 1_000_000_000);
  r %= 1_000_000_000;
  const trieu = Math.floor(r / 1_000_000);
  r %= 1_000_000;
  const nghin = Math.floor(r / 1_000);
  const don = r % 1000;
  const high = [];
  if (ty) high.push(`${readGroup(ty)} tỷ`);
  if (trieu) high.push(`${readGroup(trieu)} triệu`);
  if (nghin) high.push(`${readGroup(nghin)} nghìn`);
  const highStr = high.join(" ");
  if (don > 0) {
    const low = `${readGroup(don)} đồng`;
    return cap(highStr ? `${highStr}, ${low}` : low);
  }
  return cap(`${highStr} đồng`);
}

function oneLine(value) {
  return String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Chuỗi hiển thị đầu tiên khác rỗng (hỗ trợ giá trị DB không phải string). */
function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v == null) continue;
    const s = typeof v === "string" ? v.trim() : String(v).trim();
    if (s !== "") return s;
  }
  return null;
}

/**
 * Gộp snapshot trên phiếu (`LttpIssueSlip`) với mẫu đơn vị (`getIssueSlipById` → `printSettings`).
 * Luôn đọc `printSettings` khi có object; thứ tự ưu tiên: giá trị đã lưu trên phiếu, sau đó mẫu in.
 */
function slipWithMergedPrint(slip) {
  if (!slip) return slip;
  const ps =
    slip.printSettings != null && typeof slip.printSettings === "object"
      ? slip.printSettings
      : {};
  return {
    ...slip,
    printLine1: firstNonEmpty(slip.printLine1, ps.printLine1),
    printLine2: firstNonEmpty(slip.printLine2, ps.printLine2),
    formMauSo: firstNonEmpty(slip.formMauSo, ps.formMauSo),
    warehouseFrom: firstNonEmpty(slip.warehouseFrom, ps.warehouseFrom),
    signerWriter: firstNonEmpty(slip.signerWriter, ps.signerWriter),
    signerApprover: firstNonEmpty(slip.signerApprover, ps.signerApprover),
  };
}

/** Tên người nhận in trên phiếu: snapshot phiếu → user đã chọn → user mặc định theo đơn vị nhận (LttpRecipientUnitDefaultUser). */
function recipientDisplayForPrint(slip) {
  const nonEmpty = (v) => {
    if (v == null) return null;
    const s = String(v).trim();
    return s !== "" ? oneLine(s) : null;
  };
  return (
    nonEmpty(slip?.recipientDisplayName) ??
    nonEmpty(slip?.signerRecipient) ??
    nonEmpty(slip?.recipientUser?.fullName) ??
    nonEmpty(slip?.recipientUser?.username) ??
    nonEmpty(slip?.recipientNameFromUnitDefault) ??
    "—"
  );
}

/**
 * Vẽ chữ an toàn: luôn đo trước, luôn giới hạn `height` trong vùng [y, maxY).
 * PDFKit mặc định sẽ **tự addPage** khi `doc.text` tràn đáy trang — đây là nguồn trang trắng / trang thừa
 * khi phân trang đã tính sẵn. Cách chặn đúng là không để text flow vượt biên (height + ellipsis).
 *
 * @param {PDFKit.PDFDocument} doc
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {Record<string, unknown>} textOptions - font, fontSize, width, align, lineBreak, ellipsis — truyền xuống doc.text
 * @param {{ marginBottom: number; pageWidth: number }} layout
 * @param {number} [maxY] - đáy vùng nội dung (mặc định: doc.page.height - marginBottom)
 * @returns {number} y sau khối text (drawY + chiều cao ô vẽ)
 */
function safeText(doc, text, x, y, textOptions, layout, maxY) {
  const width = textOptions.width ?? layout.pageWidth;
  const bottom = maxY ?? doc.page.height - layout.marginBottom;

  const { font, fontSize, ...rest } = textOptions;
  if (font) doc.font(font);
  if (fontSize != null) doc.fontSize(fontSize);

  const measuredH = doc.heightOfString(String(text), {
    width,
    align: textOptions.align,
  });

  const drawY = y;
  const available = Math.max(0, bottom - drawY);
  const boxHeight = Math.min(measuredH, available);

  doc.text(String(text), x, drawY, {
    ...rest,
    width,
    height: boxHeight,
    lineBreak: textOptions.lineBreak ?? false,
    ellipsis: textOptions.ellipsis !== undefined ? textOptions.ellipsis : true,
  });

  return drawY + boxHeight;
}

function buildRowText(line) {
  const commodityName = line?.commodity?.name ? String(line.commodity.name) : "—";
  const lineNote = line?.lineNote ? String(line.lineNote).trim() : "";
  return lineNote ? `${commodityName} (${lineNote})` : commodityName;
}

function estimateDataRowHeight(doc, line, widths, fontScale = 1) {
  doc.font(FONT_REGULAR).fontSize(9 * fontScale);
  const text = oneLine(buildRowText(line));
  const textHeight = doc.heightOfString(text, {
    width: widths.name - 8,
    align: "left",
  });
  return Math.max(BASE_ROW_HEIGHT * fontScale, Math.ceil(textHeight + 8 * fontScale));
}

function paginateLines(doc, lines, firstBodyHeight, nextBodyHeight, widths, fontScale = 1) {
  const measured = lines.map((line) => ({
    line,
    height: estimateDataRowHeight(doc, line, widths, fontScale),
  }));
  if (!measured.length) {
    return [{ carryIn: 0, pageAmount: 0, transferOut: null, rows: [] }];
  }
  const pages = [];
  let index = 0;
  let carryIn = 0;
  let pageIndex = 0;
  const carryRowH = TABLE_CARRY_ROW_HEIGHT * fontScale;
  const transferRowH = TABLE_FOOTER_ROW_HEIGHT * fontScale;
  while (index < measured.length) {
    const pageRows = [];
    let occupied = carryIn > 0 ? carryRowH : 0;
    const maxBody = pageIndex === 0 ? firstBodyHeight : nextBodyHeight;
    while (index < measured.length) {
      const left = measured.length - index;
      const needTransfer = left > 1 ? transferRowH : 0;
      const next = measured[index];
      if (occupied + next.height + needTransfer <= maxBody || pageRows.length === 0) {
        pageRows.push(next);
        occupied += next.height;
        index += 1;
        continue;
      }
      break;
    }
    if (index < measured.length && measured.length - index === 1 && pageRows.length > 2) {
      const moved = pageRows.pop();
      if (moved) {
        occupied -= moved.height;
        index -= 1;
      }
    }
    const pageAmount = pageRows.reduce((sum, r) => sum + Number(r.line?.amount ?? 0), 0);
    const hasNextPage = index < measured.length;
    pages.push({
      carryIn,
      pageAmount,
      transferOut: hasNextPage ? pageAmount : null,
      rows: pageRows.map((r) => r.line),
    });
    carryIn = hasNextPage ? pageAmount : 0;
    pageIndex += 1;
  }
  return pages;
}

function pageRowsHeight(doc, rows, widths, fontScale) {
  return rows.reduce((sum, line) => sum + estimateDataRowHeight(doc, line, widths, fontScale), 0);
}

function ensureLastPageHasSignatureSpace(doc, pages, widths, firstBodyHeight, nextBodyHeight, fontScale, afterTotalRowReserveHeight) {
  if (!pages.length) return pages;
  const carryRowH = TABLE_CARRY_ROW_HEIGHT * fontScale;
  const footerRowH = TABLE_FOOTER_ROW_HEIGHT * fontScale;
  /** Không còn vẽ footer "Trang x/y" — không giữ đệm cho dòng đó. */
  const footerTextH = 0;
  /** Giữ đệm lớn (SIGNATURE_BLOCK_HEIGHT) khi ước lượng chi tiết nhỏ hơn thực tế. */
  const lastPageBottomReserve = Math.max(
    SIGNATURE_BLOCK_HEIGHT * fontScale,
    footerRowH + afterTotalRowReserveHeight,
  );

  while (pages.length) {
    const lastIdx = pages.length - 1;
    const last = pages[lastIdx];
    const bodyLimit = lastIdx === 0 ? firstBodyHeight : nextBodyHeight;
    const carryH = last.carryIn > 0 ? carryRowH : 0;
    const rowsH = pageRowsHeight(doc, last.rows, widths, fontScale);
    const totalNeed = carryH + rowsH + lastPageBottomReserve + footerTextH;

    if (totalNeed <= bodyLimit || last.rows.length <= 2) {
      break;
    }

    const moved = last.rows.pop();
    if (!moved) break;

    let next = pages[lastIdx + 1];
    if (!next) {
      next = { carryIn: 0, pageAmount: 0, transferOut: null, rows: [] };
      pages.push(next);
    }
    next.rows.unshift(moved);

    const lastAmount = last.rows.reduce((sum, r) => sum + Number(r?.amount ?? 0), 0);
    last.pageAmount = lastAmount;
    last.transferOut = lastAmount;
    next.carryIn = lastAmount;
    next.pageAmount = next.rows.reduce((sum, r) => sum + Number(r?.amount ?? 0), 0);
    next.transferOut = null;
  }

  for (let i = 0; i < pages.length; i += 1) {
    const pg = pages[i];
    const amount = pg.rows.reduce((sum, r) => sum + Number(r?.amount ?? 0), 0);
    pg.pageAmount = amount;
    pg.transferOut = i < pages.length - 1 ? amount : null;
    if (i > 0) {
      pg.carryIn = pages[i - 1].pageAmount;
    }
  }

  return pages;
}

function drawTableHeader(doc, x, y, widths, fontScale = 1) {
  const h1 = Math.max(TABLE_HEADER_HEIGHT * fontScale, 22);
  const h2 = Math.max(TABLE_HEADER_ROW2_HEIGHT * fontScale, 24);
  const totalH = h1 + h2;
  doc.rect(x, y, widths.total, totalH).stroke();
  let cx = x;
  const drawCell = (label, w, top, h, align = "center", fz = 8.5) => {
    doc.rect(cx, top, w, h).stroke();
    doc
      .font(FONT_BOLD)
      .fontSize(fz * fontScale)
      .text(label, cx + 2, top + h / 2 - 4.2 * fontScale, { width: w - 4, align, lineBreak: false, ellipsis: true });
    cx += w;
  };
  drawCell("STT", widths.stt, y, totalH);
  drawCell("Tên, quy cách vật tư, sản phẩm", widths.name, y, totalH, "left", 8);
  drawCell("Mã", widths.code, y, totalH);
  drawCell("ĐV", widths.unit, y, totalH);
  doc.rect(cx, y, widths.req + widths.qty, h1).stroke();
  doc
    .font(FONT_BOLD)
    .fontSize(8 * fontScale)
    .text("Số lượng", cx + 2, y + h1 / 2 - 4.2 * fontScale, { width: widths.req + widths.qty - 4, align: "center", lineBreak: false });
  const qtyX = cx;
  cx += widths.req + widths.qty;
  drawCell("Giá", widths.price, y, totalH, "right", 8);
  drawCell("Thành tiền", widths.amount, y, totalH, "right", 8);
  drawCell("Ghi chú", widths.note, y, totalH, "center", 8);
  doc.rect(qtyX, y + h1, widths.req, h2).stroke();
  doc.rect(qtyX + widths.req, y + h1, widths.qty, h2).stroke();
  doc
    .font(FONT_BOLD)
    .fontSize(7.2 * fontScale)
    .text("Yêu cầu", qtyX + 2, y + h1 + h2 / 2 - 3.2 * fontScale, { width: widths.req - 4, align: "center", lineBreak: false, ellipsis: true });
  doc
    .font(FONT_BOLD)
    .fontSize(7.2 * fontScale)
    .text("Thực xuất", qtyX + widths.req + 2, y + h1 + h2 / 2 - 3.2 * fontScale, {
      width: widths.qty - 4,
      align: "center",
      lineBreak: false,
      ellipsis: true,
    });
}

function drawDataRow(doc, line, rowNo, x, y, widths, rowHeight, fontScale = 1) {
  const cols = [];
  cols.push({ text: String(rowNo), width: widths.stt, align: "center" });
  cols.push({ text: oneLine(line?.commodity?.name ?? "—"), width: widths.name, align: "left" });
  cols.push({ text: oneLine(line?.commodity?.code ?? "—"), width: widths.code, align: "center" });
  cols.push({ text: line?.commodity?.measureUnit ?? "—", width: widths.unit, align: "center" });
  cols.push({ text: line?.requiredQuantity != null ? formatQty(line.requiredQuantity) : "—", width: widths.req, align: "center" });
  cols.push({ text: formatQty(line?.quantity ?? 0), width: widths.qty, align: "center" });
  cols.push({ text: formatMoney(line?.unitPrice ?? 0), width: widths.price, align: "right" });
  cols.push({ text: formatMoney(line?.amount ?? 0), width: widths.amount, align: "right" });
  cols.push({ text: oneLine(line?.lineNote ?? ""), width: widths.note, align: "center" });
  let cx = x;
  for (const c of cols) {
    doc.rect(cx, y, c.width, rowHeight).stroke();
    doc
      .font(FONT_REGULAR)
      .fontSize(9 * fontScale)
      .text(String(c.text ?? ""), cx + 3, y + 5 * fontScale, {
        width: c.width - 6,
        align: c.align,
        height: rowHeight - 6,
        lineBreak: false,
        ellipsis: true,
      });
    cx += c.width;
  }
}

function drawCarryRow(doc, x, y, widths, label, value, fontScale = 1) {
  const labelWidth = widths.total - widths.amount - widths.note;
  const rowH = TABLE_CARRY_ROW_HEIGHT * fontScale;
  doc.rect(x, y, labelWidth, rowH).stroke();
  doc.rect(x + labelWidth, y, widths.amount, rowH).stroke();
  doc.rect(x + labelWidth + widths.amount, y, widths.note, rowH).stroke();
  doc.font(FONT_BOLD).fontSize(9 * fontScale).text(label, x + 4, y + 5 * fontScale, {
    width: labelWidth - 8,
    align: "center",
    lineBreak: false,
    ellipsis: true,
  });
  doc.font(FONT_BOLD).fontSize(9 * fontScale).text(formatMoney(value), x + labelWidth + 4, y + 5 * fontScale, {
    width: widths.amount - 8,
    align: "right",
    lineBreak: false,
    ellipsis: true,
  });
}

function drawHeaderBlock(doc, slip, x, y, pageWidth, fontScale = 1) {
  const leftW = pageWidth * 0.3;
  const centerW = pageWidth * 0.4;
  const rightW = pageWidth * 0.3;
  doc
    .font(FONT_BOLD)
    .fontSize(11 * fontScale)
    .text(oneLine(slip?.printLine1 ?? ""), x, y, { width: leftW, align: "center", lineBreak: false, ellipsis: true });
  doc
    .font(FONT_BOLD)
    .fontSize(11 * fontScale)
    .text(oneLine(slip?.printLine2 ?? "").toLocaleUpperCase("vi"), x, y + 14 * fontScale, {
      width: leftW,
      align: "center",
      lineBreak: false,
      ellipsis: true,
    });
  /** Gạch ngang dưới printLine2: dài 1/2 so với trước (25% chiều ngang cột trái), căn giữa cột. */
  const underlineHalf = leftW * 0.25;
  const underlineCx = x + leftW / 2;
  const underlineY = y + 29 * fontScale;
  doc
    .moveTo(underlineCx - underlineHalf / 2, underlineY)
    .lineTo(underlineCx + underlineHalf / 2, underlineY)
    .lineWidth(0.8)
    .stroke();
  const mauSoVal = oneLine(slip?.formMauSo ?? "") || "—";
  doc
    .font(FONT_BOLD)
    .fontSize(9 * fontScale)
    .text(`Mẫu số: ${mauSoVal}`, x + leftW + centerW, y, { width: rightW, align: "center", lineBreak: false, ellipsis: true });
  doc.font(FONT_BOLD).fontSize(10 * fontScale).text(`Quyển số: ${slip?.bookMmyy ?? "—"}`, x + leftW + centerW, y + 14 * fontScale, {
    width: rightW,
    align: "center",
  });
  doc.font(FONT_BOLD).fontSize(10 * fontScale).text(`Số: ${String(slip?.slipNo ?? "").padStart(4, "0")}`, x + leftW + centerW, y + 28 * fontScale, {
    width: rightW,
    align: "center",
  });
  const titleY = y + 52 * fontScale;
  doc.font(FONT_BOLD).fontSize(14 * fontScale).text("PHIẾU XUẤT KHO", x, titleY, { width: pageWidth, align: "center" });
  doc
    .font(FONT_REGULAR)
    .fontSize(10 * fontScale)
    .text(formatIssueSlipPrintDate(slip?.issueDate) || `Ngày xuất: ${formatDate(slip?.issueDate)}`, x, titleY + 18 * fontScale, {
      width: pageWidth,
      align: "center",
    });
  doc
    .font(FONT_REGULAR)
    .fontSize(10 * fontScale)
    .text(`Họ và tên người nhận hàng: ${recipientDisplayForPrint(slip)}`, x, titleY + 38 * fontScale, {
      width: pageWidth,
      lineBreak: false,
      ellipsis: true,
    });
  doc
    .font(FONT_REGULAR)
    .fontSize(10 * fontScale)
    .text(`Đơn vị: ${oneLine(slip?.recipientUnit?.name ?? "—")}`, x, titleY + 52 * fontScale, { width: pageWidth, lineBreak: false, ellipsis: true });
  doc
    .font(FONT_REGULAR)
    .fontSize(10 * fontScale)
    .text(`Nhận tại kho: ${oneLine(slip?.warehouseFrom ?? "—")}`, x, titleY + 66 * fontScale, { width: pageWidth, lineBreak: false, ellipsis: true });
  return titleY + 84 * fontScale;
}

async function buildIssueSlipPdfBuffer(slip) {
  const slipForDisplay = slipWithMergedPrint(slip);
  const cmToPt = (cm) => Number(cm) * 28.3464567;
  const settings = slip?.printSettings ?? null;
  const marginTop = Number.isFinite(Number(settings?.marginTopCm)) ? cmToPt(settings.marginTopCm) : DEFAULT_PAGE_MARGIN;
  const marginRight = Number.isFinite(Number(settings?.marginRightCm)) ? cmToPt(settings.marginRightCm) : DEFAULT_PAGE_MARGIN;
  const marginBottom = Number.isFinite(Number(settings?.marginBottomCm)) ? cmToPt(settings.marginBottomCm) : DEFAULT_PAGE_MARGIN;
  const marginLeft = Number.isFinite(Number(settings?.marginLeftCm)) ? cmToPt(settings.marginLeftCm) : DEFAULT_PAGE_MARGIN;
  const baseFontSize = Number.isFinite(Number(settings?.printFontSizePt))
    ? Math.max(8, Math.min(18, Number(settings.printFontSizePt)))
    : 12;
  const fontScale = baseFontSize / 12;
  const doc = new PDFDocument({
    size: PAGE_SIZE,
    margins: { top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft },
    autoFirstPage: true,
    compress: true,
  });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on("end", resolve);
    doc.on("error", reject);
  });

  const pageWidth = doc.page.width - marginLeft - marginRight;
  doc.registerFont("vi-regular", FONT_REGULAR);
  doc.registerFont("vi-bold", FONT_BOLD);
  const widths = {
    stt: Math.round(pageWidth * 0.04),
    name: Math.round(pageWidth * 0.30),
    code: Math.round(pageWidth * 0.07),
    unit: Math.round(pageWidth * 0.04),
    req: Math.round(pageWidth * 0.055),
    qty: Math.round(pageWidth * 0.055),
    price: Math.round(pageWidth * 0.10),
    amount: Math.round(pageWidth * 0.13),
    note: Math.round(pageWidth * 0.21),
  };
  widths.total = Object.values(widths).reduce((sum, v) => (Number.isFinite(v) ? sum + v : sum), 0);
  widths.note += pageWidth - widths.total;
  widths.total = pageWidth;
  const totalAmountForReserve = (slip.lines ?? []).reduce((sum, line) => sum + Number(line?.amount ?? 0), 0);
  const totalWordsText = `Tổng số tiền (Viết bằng chữ): ${vndToVietnameseDocumentLine(totalAmountForReserve) || "—"}`;
  doc.font(FONT_REGULAR).fontSize(9 * fontScale);
  const totalWordsHeight = doc.heightOfString(totalWordsText, { width: pageWidth });
  /**
   * Phần sau dòng "Tổng thành tiền" (footerRowH được cộng riêng trong ensureLastPageHasSignatureSpace).
   */
  const afterTotalRowReserveHeight =
    8 * fontScale +
    totalWordsHeight +
    18 * fontScale +
    56 * fontScale +
    14 * fontScale;
  const firstBodyHeight = doc.page.height - marginBottom - marginTop - FIRST_PAGE_FIXED_HEIGHT * fontScale;
  const nextBodyHeight = doc.page.height - marginBottom - marginTop - NEXT_PAGE_FIXED_HEIGHT * fontScale;
  const pages = ensureLastPageHasSignatureSpace(
    doc,
    paginateLines(doc, slip.lines ?? [], firstBodyHeight, nextBodyHeight, widths, fontScale),
    widths,
    firstBodyHeight,
    nextBodyHeight,
    fontScale,
    afterTotalRowReserveHeight,
  );
  const textLayout = { marginBottom, pageWidth };
  const contentBottomY = doc.page.height - marginBottom;

  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) doc.addPage({ size: PAGE_SIZE, margins: { top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft } });
    const x = marginLeft;
    let y = pageIndex === 0 ? drawHeaderBlock(doc, slipForDisplay, x, marginTop, pageWidth, fontScale) : marginTop;

    drawTableHeader(doc, x, y, widths, fontScale);
    y += (TABLE_HEADER_HEIGHT + TABLE_HEADER_ROW2_HEIGHT) * fontScale;
    if (page.carryIn > 0) {
      drawCarryRow(doc, x, y, widths, "Mang sang", page.carryIn, fontScale);
      y += TABLE_CARRY_ROW_HEIGHT * fontScale;
    }
    let rowNo = pages.slice(0, pageIndex).reduce((s, p) => s + p.rows.length, 0) + 1;
    page.rows.forEach((line) => {
      const rowHeight = estimateDataRowHeight(doc, line, widths, fontScale);
      drawDataRow(doc, line, rowNo, x, y, widths, rowHeight, fontScale);
      y += rowHeight;
      rowNo += 1;
    });
    if (page.transferOut != null) {
      drawCarryRow(doc, x, y, widths, "Cộng sang trang", page.transferOut, fontScale);
      y += TABLE_FOOTER_ROW_HEIGHT * fontScale;
    }

    if (pageIndex === pages.length - 1) {
      const totalAmount = totalAmountForReserve;
      drawCarryRow(doc, x, y, widths, "Tổng thành tiền", totalAmount, fontScale);
      y += TABLE_FOOTER_ROW_HEIGHT * fontScale + 8 * fontScale;
      doc.font(FONT_REGULAR).fontSize(9 * fontScale);
      const wordsBottom = safeText(
        doc,
        totalWordsText,
        x,
        y,
        {
          font: FONT_REGULAR,
          fontSize: 9 * fontScale,
          width: pageWidth,
          lineBreak: true,
          ellipsis: true,
        },
        textLayout,
        contentBottomY,
      );
      const signY = wordsBottom + 18 * fontScale;
      const signW = pageWidth / 3;
      const titleOpts = {
        font: FONT_BOLD,
        fontSize: 10 * fontScale,
        width: signW,
        align: "center",
        lineBreak: false,
        ellipsis: true,
      };
      safeText(doc, "Người viết phiếu", x, signY, titleOpts, textLayout, contentBottomY);
      safeText(doc, "Người nhận hàng", x + signW, signY, titleOpts, textLayout, contentBottomY);
      safeText(doc, "Người duyệt", x + signW * 2, signY, titleOpts, textLayout, contentBottomY);
      const namesY = signY + 56 * fontScale;
      const nameOpts = {
        font: FONT_BOLD,
        fontSize: 10 * fontScale,
        width: signW,
        align: "center",
        lineBreak: false,
        ellipsis: true,
      };
      const n1 = safeText(doc, oneLine(slipForDisplay?.signerWriter ?? "—"), x, namesY, nameOpts, textLayout, contentBottomY);
      const n2 = safeText(doc, recipientDisplayForPrint(slip), x + signW, namesY, nameOpts, textLayout, contentBottomY);
      const n3 = safeText(doc, oneLine(slipForDisplay?.signerApprover ?? "—"), x + signW * 2, namesY, nameOpts, textLayout, contentBottomY);
      y = Math.max(n1, n2, n3) + 12 * fontScale;
    }
  });
  doc.end();
  await done;
  return Buffer.concat(chunks);
}

export { buildIssueSlipPdfBuffer };
