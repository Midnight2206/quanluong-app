import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import {
  CHUNG_TU_CATEGORY_KEYS,
  CHUNG_TU_DEFAULT_SHEET_TABLE,
  getCategoryMeta,
} from "./chung-tu-category.constants.js";
import { normalizeFillRulesV2 } from "./chung-tu-quyet-toan.service.js";
import { paginateChungTuPrintRows, parseVietnameseNumber } from "./chung-tu-print-pagination.js";

const FONT_REGULAR = path.resolve(process.cwd(), "assets/fonts/Times New Roman.ttf");
const FONT_BOLD = path.resolve(process.cwd(), "assets/fonts/Times New Roman Bold.ttf");
const TABLE_HEADER_HEIGHT = 24;
const TABLE_CARRY_ROW_HEIGHT = 20;
const DEFAULT_ROW_HEIGHT = 20;
const HEADER_BLOCK_HEIGHT = 118;
const FINAL_BLOCK_RESERVE_HEIGHT = 130;

function cmToPt(cm) {
  return Number(cm) * 28.3464567;
}

function oneLine(value) {
  return String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatNumber(value) {
  const n = typeof value === "number" ? value : parseVietnameseNumber(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("vi-VN");
}

function fieldValue(row, fieldKey) {
  if (!row || typeof row !== "object") return "";
  const value = row[fieldKey];
  if (value == null) return "";
  if (typeof value === "number") return value.toLocaleString("vi-VN");
  return String(value);
}

function normalizePrintInputs({ categoryKey, fillRules }) {
  const normalized = normalizeFillRulesV2(fillRules, "spreadsheet");
  const defaultTable = CHUNG_TU_DEFAULT_SHEET_TABLE[categoryKey] ?? {};
  const detailTable = normalized.sheets?.detailTable ?? defaultTable;
  const columns = Array.isArray(detailTable?.columns) && detailTable.columns.length
    ? detailTable.columns
    : (defaultTable.columns ?? []);
  const pdf = normalized.print?.pdf ?? {};
  const table = pdf.table ?? {};
  const headerLabels = Array.isArray(table.headerLabels) && table.headerLabels.length
    ? table.headerLabels
    : Array.isArray(detailTable?.repeatHeaderLabels) && detailTable.repeatHeaderLabels.length
      ? detailTable.repeatHeaderLabels
      : columns;
  return { normalized, pdf, table, columns, headerLabels };
}

function buildColumnWidths(columns, pageWidth) {
  const weightsByKey = {
    stt: 0.06,
    tenHang: 0.28,
    maSo: 0.08,
    dvt: 0.08,
    nguoiBan: 0.18,
    soLuong: 0.1,
    donGia: 0.14,
    thanhTien: 0.16,
    ghiChu: 0.14,
  };
  const rawWeights = columns.map((key) => weightsByKey[key] ?? 1);
  const totalWeight = rawWeights.reduce((sum, weight) => sum + weight, 0) || 1;
  const widths = rawWeights.map((weight) => Math.round((pageWidth * weight) / totalWeight));
  const diff = pageWidth - widths.reduce((sum, width) => sum + width, 0);
  widths[widths.length - 1] += diff;
  return widths;
}

function estimateRowHeight(doc, row, columns, widths, fontSize) {
  doc.font(chungTuFontName(doc, false)).fontSize(fontSize);
  const heights = columns.map((key, index) => {
    const text = oneLine(fieldValue(row, key));
    return doc.heightOfString(text || " ", {
      width: Math.max(12, widths[index] - 6),
      align: key === "tenHang" || key === "nguoiBan" ? "left" : "center",
    });
  });
  return Math.max(DEFAULT_ROW_HEIGHT, Math.ceil(Math.max(...heights) + 8));
}

function drawText(doc, text, x, y, options = {}) {
  const font = chungTuFontName(doc, Boolean(options.bold));
  doc.font(font).fontSize(options.fontSize ?? 10).text(String(text ?? ""), x, y, {
    width: options.width,
    align: options.align ?? "left",
    height: options.height,
    lineBreak: options.lineBreak ?? false,
    ellipsis: options.ellipsis ?? true,
  });
}

function drawHeaderBlock(doc, context, x, y, pageWidth, categoryKey) {
  const leftW = pageWidth * 0.32;
  const centerW = pageWidth * 0.36;
  const rightW = pageWidth * 0.32;
  drawText(doc, oneLine(context.donViCapTren), x, y, { width: leftW, align: "center", bold: true });
  drawText(doc, oneLine(context.donViSo), x, y + 14, { width: leftW, align: "center", bold: true });
  drawText(doc, `Quyển số: ${oneLine(context.quyenSo) || "..."}`, x + leftW + centerW, y, {
    width: rightW,
    align: "center",
    bold: true,
  });
  drawText(doc, `Số: ${oneLine(context.so ?? context.soChungTu) || "..."}`, x + leftW + centerW, y + 14, {
    width: rightW,
    align: "center",
    bold: true,
  });
  const title =
    categoryKey === CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG
      ? "BẢNG KÊ MUA HÀNG"
      : (getCategoryMeta(categoryKey)?.label ?? "Chứng từ quyết toán").toLocaleUpperCase("vi");
  drawText(doc, title, x, y + 44, { width: pageWidth, align: "center", bold: true, fontSize: 15 });
  drawText(doc, oneLine(context.ngayThangNam), x, y + 64, {
    width: pageWidth,
    align: "center",
    fontSize: 10,
  });
  drawText(doc, `Bộ phận: ${oneLine(context.boPhan)}`, x, y + 88, {
    width: pageWidth,
    fontSize: 10,
  });
  return y + HEADER_BLOCK_HEIGHT;
}

function drawTableHeader(doc, x, y, widths, labels, fontSize) {
  let cx = x;
  for (let i = 0; i < widths.length; i += 1) {
    doc.rect(cx, y, widths[i], TABLE_HEADER_HEIGHT).stroke();
    drawText(doc, labels[i] ?? "", cx + 3, y + 6, {
      width: widths[i] - 6,
      align: "center",
      bold: true,
      fontSize: Math.max(8, fontSize - 1),
    });
    cx += widths[i];
  }
}

function drawDataRow(doc, row, x, y, columns, widths, rowHeight, fontSize) {
  let cx = x;
  for (let i = 0; i < columns.length; i += 1) {
    const key = columns[i];
    const align = key === "tenHang" || key === "nguoiBan" ? "left" : key === "donGia" || key === "thanhTien" ? "right" : "center";
    doc.rect(cx, y, widths[i], rowHeight).stroke();
    drawText(doc, fieldValue(row, key), cx + 3, y + 5, {
      width: widths[i] - 6,
      height: rowHeight - 6,
      align,
      fontSize,
      lineBreak: true,
    });
    cx += widths[i];
  }
}

function drawCarryRow(doc, x, y, widths, amountColumnIndex, label, value, fontSize) {
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  const amountX = x + widths.slice(0, amountColumnIndex).reduce((sum, width) => sum + width, 0);
  const amountW = widths[amountColumnIndex] ?? widths[widths.length - 1];
  doc.rect(x, y, totalWidth, TABLE_CARRY_ROW_HEIGHT).stroke();
  doc
    .moveTo(amountX, y)
    .lineTo(amountX, y + TABLE_CARRY_ROW_HEIGHT)
    .stroke();
  doc
    .moveTo(amountX + amountW, y)
    .lineTo(amountX + amountW, y + TABLE_CARRY_ROW_HEIGHT)
    .stroke();
  drawText(doc, label, x + 4, y + 5, {
    width: Math.max(10, amountX - x - 8),
    align: "center",
    bold: true,
    fontSize,
  });
  drawText(doc, formatNumber(value), amountX + 4, y + 5, {
    width: amountW - 8,
    align: "right",
    bold: true,
    fontSize,
  });
}

function drawFinalBlock(doc, context, x, y, pageWidth, fontSize) {
  drawText(doc, `Số tiền bằng chữ: ${oneLine(context.tongTienBangChu)}`, x, y + 8, {
    width: pageWidth,
    fontSize,
    lineBreak: true,
  });
  const signY = y + 38;
  const signers = [
    ["Người mua", context.signerNguoiMua ?? context.nguoiMua],
    ["Phụ trách bộ phận", context.signerPhuTrachBoPhan ?? context.phuTrachBoPhan],
    ["Tài chính", context.signerTaiChinh ?? context.taiChinh],
    ["Thủ trưởng đơn vị", context.signerApprover ?? context.thuTruongDonVi],
  ];
  const signW = pageWidth / signers.length;
  signers.forEach(([label, name], index) => {
    const sx = x + signW * index;
    drawText(doc, label, sx, signY, { width: signW, align: "center", bold: true, fontSize });
    drawText(doc, oneLine(name), sx, signY + 58, { width: signW, align: "center", bold: true, fontSize });
  });
}

function buildSections(context) {
  const sheetContexts = Array.isArray(context?.sheetContexts) ? context.sheetContexts : [];
  if (!sheetContexts.length) return [context ?? {}];
  const nonEmpty = sheetContexts.filter((ctx) => Array.isArray(ctx.detailRows) && ctx.detailRows.length > 0);
  return nonEmpty.length ? nonEmpty : [sheetContexts[0]];
}

function chungTuFontName(doc, bold) {
  const fonts = doc._chungTuPdfFonts ?? {};
  return bold ? (fonts.bold ?? "Times-Bold") : (fonts.regular ?? "Times-Roman");
}

function registerChungTuFonts(doc) {
  if (fs.existsSync(FONT_REGULAR) && fs.existsSync(FONT_BOLD)) {
    doc.registerFont("vi-regular", FONT_REGULAR);
    doc.registerFont("vi-bold", FONT_BOLD);
    doc._chungTuPdfFonts = { regular: "vi-regular", bold: "vi-bold" };
    return;
  }
  doc._chungTuPdfFonts = { regular: "Times-Roman", bold: "Times-Bold" };
}

async function buildChungTuPrintPdfBuffer({ categoryKey, context, fillRules }) {
  const { pdf, table, columns, headerLabels } = normalizePrintInputs({ categoryKey, fillRules });
  const margins = {
    top: cmToPt(pdf.marginTopCm ?? 1.5),
    right: cmToPt(pdf.marginRightCm ?? 1.5),
    bottom: cmToPt(pdf.marginBottomCm ?? 1.5),
    left: cmToPt(pdf.marginLeftCm ?? 1.5),
  };
  const doc = new PDFDocument({
    size: pdf.pageSize ?? "A4",
    layout: pdf.orientation === "landscape" ? "landscape" : "portrait",
    margins,
    autoFirstPage: true,
    compress: true,
  });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on("end", resolve);
    doc.on("error", reject);
  });
  registerChungTuFonts(doc);

  const pageWidth = doc.page.width - margins.left - margins.right;
  const pageHeight = doc.page.height;
  const widths = buildColumnWidths(columns, pageWidth);
  const amountFieldKey = table.amountFieldKey || "thanhTien";
  const amountColumnIndex = Math.max(0, columns.indexOf(amountFieldKey));
  const fontSize = Number(pdf.fontSizePt ?? 11);
  const bodyFirst = pageHeight - margins.top - margins.bottom - HEADER_BLOCK_HEIGHT - TABLE_HEADER_HEIGHT - FINAL_BLOCK_RESERVE_HEIGHT;
  const bodyNext = pageHeight - margins.top - margins.bottom - TABLE_HEADER_HEIGHT - FINAL_BLOCK_RESERVE_HEIGHT;
  const sections = buildSections(context);

  sections.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) {
      doc.addPage();
    }
    const rows = Array.isArray(section.detailRows) ? section.detailRows : [];
    const pages = paginateChungTuPrintRows({
      rows,
      firstPageBodyHeight: bodyFirst,
      nextPageBodyHeight: bodyNext,
      rowHeight: (row, index) => estimateRowHeight(doc, row, columns, widths, fontSize, index),
      carryRowHeight: TABLE_CARRY_ROW_HEIGHT,
      transferRowHeight: TABLE_CARRY_ROW_HEIGHT,
      amountFieldKey,
    });

    pages.forEach((page, pageIndex) => {
      if (pageIndex > 0) {
        doc.addPage();
      }
      const x = margins.left;
      let y = pageIndex === 0
        ? drawHeaderBlock(doc, section, x, margins.top, pageWidth, categoryKey)
        : margins.top;
      drawTableHeader(doc, x, y, widths, headerLabels, fontSize);
      y += TABLE_HEADER_HEIGHT;
      if (page.carryIn > 0) {
        drawCarryRow(doc, x, y, widths, amountColumnIndex, table.carryInLabel || "Mang sang", page.carryIn, fontSize);
        y += TABLE_CARRY_ROW_HEIGHT;
      }
      page.rows.forEach((row, rowIndex) => {
        const h = page.rowHeights[rowIndex] ?? estimateRowHeight(doc, row, columns, widths, fontSize);
        drawDataRow(doc, row, x, y, columns, widths, h, fontSize);
        y += h;
      });
      if (page.carryOut != null) {
        drawCarryRow(doc, x, y, widths, amountColumnIndex, table.carryOutLabel || "Cộng sang trang", page.carryOut, fontSize);
        y += TABLE_CARRY_ROW_HEIGHT;
      }
      if (pageIndex === pages.length - 1) {
        const total = rows.reduce((sum, row) => sum + parseVietnameseNumber(row?.[amountFieldKey]), 0);
        drawCarryRow(doc, x, y, widths, amountColumnIndex, table.totalLabel || "Tổng thành tiền", total, fontSize);
        drawFinalBlock(doc, { ...context, ...section }, x, y + TABLE_CARRY_ROW_HEIGHT, pageWidth, fontSize);
      }
    });
  });

  doc.end();
  await done;
  return Buffer.concat(chunks);
}

export { buildChungTuPrintPdfBuffer };
