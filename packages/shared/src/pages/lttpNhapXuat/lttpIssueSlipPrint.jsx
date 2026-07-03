import {
  FORM_FIELD_DEFAULTS,
  LTTP_PRINT_FONT_CHOICES,
  coercePrintFontId,
  coercePrintFontSizePt,
  resolveLttpPrintFont,
} from "./lttpIssueSlipPrint.shared";
import {
  resolveIssueSlipAppliedUnitPrice,
  resolveIssueSlipDisplayQuantities,
} from "./lttpIssueSlipPriceKind";

export {
  FORM_FIELD_DEFAULTS,
  LTTP_PRINT_FONT_CHOICES,
  coercePrintFontId,
  coercePrintFontSizePt,
  resolveLttpPrintFont,
};

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v == null) continue;
    const s = typeof v === "string" ? v.trim() : String(v).trim();
    if (s !== "") return s;
  }
  return null;
}

/** Giá trị snapshot phiếu → mẫu đơn vị → mặc định form (khớp hydrate tab Phiếu xuất). */
export function slipFieldOrDefault(slipVal, settingsVal, hardDefault) {
  const fromSlip = firstNonEmpty(slipVal);
  if (fromSlip != null) return fromSlip;
  const fromSettings = firstNonEmpty(settingsVal);
  if (fromSettings != null) return fromSettings;
  return hardDefault;
}

/** Header / kho / chữ ký — merge snapshot phiếu + mẫu in đơn vị. */
export function resolveSlipPrintMetaFromSources(slipSnapshot = {}, printSettings = {}) {
  return {
    printHeaderLine1: slipFieldOrDefault(
      slipSnapshot.printLine1,
      printSettings.printLine1,
      FORM_FIELD_DEFAULTS.printHeaderLine1,
    ),
    printHeaderLine2: slipFieldOrDefault(
      slipSnapshot.printLine2,
      printSettings.printLine2,
      FORM_FIELD_DEFAULTS.printHeaderLine2,
    ),
    formMauSo: slipFieldOrDefault(
      slipSnapshot.formMauSo,
      printSettings.formMauSo,
      FORM_FIELD_DEFAULTS.formMauSo,
    ),
    warehouseFrom: slipFieldOrDefault(
      slipSnapshot.warehouseFrom,
      printSettings.warehouseFrom,
      FORM_FIELD_DEFAULTS.warehouseFrom,
    ),
    signerWriter: slipFieldOrDefault(
      slipSnapshot.signerWriter,
      printSettings.signerWriter,
      FORM_FIELD_DEFAULTS.signerWriter,
    ),
    signerApprover: slipFieldOrDefault(
      slipSnapshot.signerApprover,
      printSettings.signerApprover,
      FORM_FIELD_DEFAULTS.signerApprover,
    ),
  };
}

export function computeLinePrintAmount(quantity, unitPrice) {
  if (unitPrice == null) {
    return 0;
  }
  const q = Number(quantity);
  const p = Number(unitPrice);
  if (!Number.isFinite(q) || !Number.isFinite(p)) {
    return 0;
  }
  return Math.round(q * p * 100) / 100;
}

/** Lề + font từ object cài đặt in (tab Phiếu xuất hoặc `printSettings` API). */
export function buildLttpPrintLayoutFromSettings(settings = {}) {
  const n = (v, fallback) =>
    Number.isFinite(Number(v)) ? Number(v) : fallback;
  const printFontId = coercePrintFontId(settings.printFontId);
  const font = resolveLttpPrintFont(printFontId);
  const fontSizePt = coercePrintFontSizePt(settings.printFontSizePt);
  return {
    marginTop: n(settings.marginTopCm ?? settings.marginTop, FORM_FIELD_DEFAULTS.marginTop),
    marginRight: n(settings.marginRightCm ?? settings.marginRight, FORM_FIELD_DEFAULTS.marginRight),
    marginBottom: n(settings.marginBottomCm ?? settings.marginBottom, FORM_FIELD_DEFAULTS.marginBottom),
    marginLeft: n(settings.marginLeftCm ?? settings.marginLeft, FORM_FIELD_DEFAULTS.marginLeft),
    printFontId,
    fontFamily: font.value,
    fontSizePt,
  };
}

/**
 * Payload `slip` cho `LttpIssueSlipPrintDocument` — một nguồn duy nhất cho mọi tab.
 */
export function buildLttpIssueSlipForPrintDocument({
  printHeaderLine1,
  printHeaderLine2,
  formMauSo,
  bookMmyy,
  slipNo,
  issueDate,
  slipNote,
  recipientName,
  recipientUnitLabel,
  warehouseFrom,
  signerWriter,
  signerRecipient,
  signerApprover,
  lines,
}) {
  return {
    printLine1: printHeaderLine1,
    printLine2: printHeaderLine2,
    formMauSo,
    bookMmyy,
    slipNo,
    issueDate,
    note: slipNote?.trim() ? slipNote.trim() : null,
    recipientDisplayName: recipientName,
    recipientUnit: { name: recipientUnitLabel || "—" },
    warehouseFrom: warehouseFrom || "—",
    lines: lines ?? [],
    signerWriter,
    signerRecipient: signerRecipient || recipientName,
    signerApprover,
  };
}

/** Tên người nhận — khớp effect tab Phiếu xuất (chế độ sửa). */
export function resolveRecipientNameForPrint(apiSlip) {
  const dbDisplay = String(apiSlip?.recipientDisplayName ?? "").trim();
  if (dbDisplay !== "") {
    return dbDisplay;
  }
  const user = apiSlip?.recipientUser;
  if (user) {
    const fn = user.fullName != null ? String(user.fullName).trim() : "";
    if (fn !== "") return fn;
    const un = user.username != null ? String(user.username).trim() : "";
    if (un !== "") return un;
  }
  const def = apiSlip?.recipientNameFromUnitDefault;
  if (def != null && String(def).trim() !== "") {
    return String(def).trim();
  }
  return "";
}

/**
 * Map dòng form → dòng in (dùng chung với tab Phiếu xuất).
 * @param {Function} parseQty - ví dụ `parsePositiveDecimalField` từ tab form
 */
export function mapFormRowsToPrintLines(rows, comById, parseQty) {
  return rows.map((r) => {
    const c = r.commodityId ? comById.get(r.commodityId) : null;
    const quantity = parseQty(r.quantity);
    const unitPrice = resolveIssueSlipAppliedUnitPrice(r);
    const { quantityMarket, quantityTgsx } = resolveIssueSlipDisplayQuantities({
      priceKind: r.priceKind,
      quantity,
    });
    return {
      id: r.key,
      amount: computeLinePrintAmount(quantity, unitPrice),
      quantity,
      quantityMarket,
      quantityTgsx,
      unitPrice,
      priceKind: r.priceKind,
      commodity: c,
      lineNote: (r.lineNote ?? "").trim(),
    };
  });
}

export function mapApiLinesToPrintLines(lines) {
  return (lines ?? []).map((line) => {
    const quantity = line.quantity;
    const unitPrice =
      line.appliedUnitPrice != null && Number.isFinite(Number(line.appliedUnitPrice))
        ? Number(line.appliedUnitPrice)
        : resolveIssueSlipAppliedUnitPrice(line);
    const { quantityMarket, quantityTgsx } = resolveIssueSlipDisplayQuantities({
      priceKind: line.priceKind,
      quantity,
    });
    return {
      id: line.id,
      amount: computeLinePrintAmount(quantity, unitPrice),
      quantity,
      quantityMarket,
      quantityTgsx,
      unitPrice,
      priceKind: line.priceKind,
      commodity: line.commodity,
      lineNote: (line.lineNote ?? "").trim(),
    };
  });
}

/**
 * Tham số in thống nhất — tab Phiếu xuất và Lịch sử đều chuẩn hoá về shape này
 * rồi gọi `buildLttpIssueSlipPrintJob`.
 */
export function normalizeLttpIssueSlipPrintParams(raw = {}) {
  return {
    printHeaderLine1: raw.printHeaderLine1 ?? FORM_FIELD_DEFAULTS.printHeaderLine1,
    printHeaderLine2: raw.printHeaderLine2 ?? FORM_FIELD_DEFAULTS.printHeaderLine2,
    formMauSo: raw.formMauSo ?? FORM_FIELD_DEFAULTS.formMauSo,
    bookMmyy: raw.bookMmyy,
    slipNo: raw.slipNo,
    issueDate: raw.issueDate,
    slipNote: raw.slipNote ?? "",
    recipientName: raw.recipientName ?? "",
    recipientUnitLabel: raw.recipientUnitLabel ?? "—",
    warehouseFrom: raw.warehouseFrom ?? FORM_FIELD_DEFAULTS.warehouseFrom,
    signerWriter: raw.signerWriter ?? FORM_FIELD_DEFAULTS.signerWriter,
    signerRecipient: raw.signerRecipient ?? "",
    signerApprover: raw.signerApprover ?? FORM_FIELD_DEFAULTS.signerApprover,
    lines: raw.lines ?? [],
    marginTop: raw.marginTop ?? FORM_FIELD_DEFAULTS.marginTop,
    marginRight: raw.marginRight ?? FORM_FIELD_DEFAULTS.marginRight,
    marginBottom: raw.marginBottom ?? FORM_FIELD_DEFAULTS.marginBottom,
    marginLeft: raw.marginLeft ?? FORM_FIELD_DEFAULTS.marginLeft,
    printFontId: coercePrintFontId(raw.printFontId),
    printFontSizePt: coercePrintFontSizePt(raw.printFontSizePt),
  };
}

/**
 * Chuẩn hoá từ state tab Phiếu xuất (preview / in trực tiếp).
 */
export function collectLttpIssueSlipPrintParamsFromForm({
  printHeaderLine1,
  printHeaderLine2,
  formMauSo,
  bookMmyy,
  slipNo,
  issueDate,
  slipNote,
  recipientName,
  recipientUnitLabel,
  warehouseFrom,
  signerWriter,
  signerRecipient,
  signerApprover,
  lines,
  marginTop,
  marginRight,
  marginBottom,
  marginLeft,
  printFontId,
  printFontSizePt,
}) {
  return normalizeLttpIssueSlipPrintParams({
    printHeaderLine1,
    printHeaderLine2,
    formMauSo,
    bookMmyy,
    slipNo,
    issueDate,
    slipNote,
    recipientName,
    recipientUnitLabel,
    warehouseFrom,
    signerWriter,
    signerRecipient,
    signerApprover,
    lines,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    printFontId,
    printFontSizePt,
  });
}

/**
 * Chuẩn hoá từ GET `/lttp/issue-slips/:id` — cùng quy tắc merge với form sau hydrate.
 */
export function collectLttpIssueSlipPrintParamsFromApiSlip(apiSlip) {
  const ps =
    apiSlip?.printSettings != null && typeof apiSlip.printSettings === "object"
      ? apiSlip.printSettings
      : {};
  const recipientName = resolveRecipientNameForPrint(apiSlip);
  const signerRecipient =
    apiSlip?.signerRecipient != null && String(apiSlip.signerRecipient).trim() !== ""
      ? String(apiSlip.signerRecipient).trim()
      : recipientName;
  const meta = resolveSlipPrintMetaFromSources(apiSlip, ps);

  return normalizeLttpIssueSlipPrintParams({
    ...meta,
    bookMmyy: apiSlip?.bookMmyy,
    slipNo: apiSlip?.slipNo,
    issueDate: apiSlip?.issueDate,
    slipNote: apiSlip?.note,
    recipientName,
    recipientUnitLabel: apiSlip?.recipientUnit?.name ?? "—",
    signerRecipient,
    lines: mapApiLinesToPrintLines(apiSlip?.lines),
    marginTop: ps.marginTopCm,
    marginRight: ps.marginRightCm,
    marginBottom: ps.marginBottomCm,
    marginLeft: ps.marginLeftCm,
    printFontId: ps.printFontId,
    printFontSizePt: ps.printFontSizePt,
  });
}

/**
 * **Luồng in duy nhất** — mọi tab gọi hàm này.
 * @returns {{ slip: object, layout: object }}
 */
export function buildLttpIssueSlipPrintJob(params) {
  const p = normalizeLttpIssueSlipPrintParams(params);
  return {
    slip: buildLttpIssueSlipForPrintDocument(p),
    layout: buildLttpPrintLayoutFromSettings({
      marginTopCm: p.marginTop,
      marginRightCm: p.marginRight,
      marginBottomCm: p.marginBottom,
      marginLeftCm: p.marginLeft,
      printFontId: p.printFontId,
      printFontSizePt: p.printFontSizePt,
    }),
  };
}

/** @deprecated — dùng `buildLttpIssueSlipPrintJob(collectLttpIssueSlipPrintParamsFromForm(...))` */
export function buildLttpIssueSlipPrintJobFromForm(params) {
  return buildLttpIssueSlipPrintJob(collectLttpIssueSlipPrintParamsFromForm(params));
}

/** @deprecated — dùng `buildLttpIssueSlipPrintJob(collectLttpIssueSlipPrintParamsFromApiSlip(...))` */
export function buildLttpIssueSlipPrintJobFromApiSlip(apiSlip) {
  return buildLttpIssueSlipPrintJob(collectLttpIssueSlipPrintParamsFromApiSlip(apiSlip));
}

/** @type {{ print: (jobs: object[]) => Promise<void> } | null} */
let printHostApi = null;

/** Phiếu xuất tab — luôn giữ bản in trong DOM (preview + in). */
let livePrintJob = null;
const livePrintJobListeners = new Set();

export function registerLttpIssueSlipLivePrintJob(job) {
  livePrintJob = job ?? null;
  livePrintJobListeners.forEach((fn) => fn());
}

export function getLttpIssueSlipLivePrintJob() {
  return livePrintJob;
}

export function subscribeLttpIssueSlipLivePrintJob(listener) {
  livePrintJobListeners.add(listener);
  return () => {
    livePrintJobListeners.delete(listener);
  };
}

export function registerLttpIssueSlipPrintHost(api) {
  printHostApi = api;
}

export function unregisterLttpIssueSlipPrintHost(api) {
  if (printHostApi === api) {
    printHostApi = null;
  }
}

export function buildPrintPageCss(layout) {
  const marginTop = layout.marginTop;
  const marginRight = layout.marginRight;
  const marginBottom = layout.marginBottom;
  const marginLeft = layout.marginLeft;
  const fontFamily = layout.fontFamily ?? "'Times New Roman', Times, serif";
  const fontSizePt = layout.fontSizePt ?? 12;
  return `
          .lttp-issue-slip-print-root {
            display: none;
          }
          @page {
            size: A4 portrait;
            margin: ${marginTop}cm ${marginRight}cm ${marginBottom}cm ${marginLeft}cm;
          }
          @media print {
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              height: auto !important;
            }
            body * {
              visibility: hidden;
            }
            .lttp-issue-slip-print-root,
            .lttp-issue-slip-print-root * {
              visibility: visible;
            }
            .lttp-issue-slip-print-root {
              display: block !important;
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              color: #000;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .lttp-isd-print {
              font-family: ${fontFamily} !important;
              font-size: ${fontSizePt}pt !important;
              line-height: 1.35 !important;
            }
            .lttp-isd-page + .lttp-isd-page {
              break-before: page;
              page-break-before: always;
            }
            .lttp-isd-print table {
              table-layout: fixed !important;
              width: 100% !important;
            }
            .lttp-isd-print .lttp-isd-nowrap {
              white-space: nowrap !important;
            }
            .lttp-isd-print .lttp-isd-unit {
              overflow-wrap: anywhere !important;
              word-break: break-word !important;
              line-height: 1.2 !important;
            }
          }
        `;
}

/**
 * In một hoặc nhiều phiếu — luồng duy nhất cho tab Phiếu xuất và Lịch sử.
 */
export function printLttpIssueSlipPrintJobs(jobs) {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return Promise.reject(new Error("Không có phiếu để in."));
  }
  if (typeof document === "undefined") {
    return Promise.reject(new Error("Chỉ in được trên trình duyệt."));
  }
  if (!printHostApi) {
    return Promise.reject(
      new Error("Chưa sẵn sàng in — tải lại trang Nhập xuất LTTP."),
    );
  }
  return printHostApi.print(jobs);
}

/** In phiếu đã lưu từ API — wrapper tiện cho Lịch sử xuất. */
export function printLttpIssueSlipFromApiSlip(apiSlip) {
  return printLttpIssueSlipPrintJobs([
    buildLttpIssueSlipPrintJob(collectLttpIssueSlipPrintParamsFromApiSlip(apiSlip)),
  ]);
}

/** In nhiều phiếu đã lưu từ API. */
export function printLttpIssueSlipsFromApiSlips(apiSlips) {
  return printLttpIssueSlipPrintJobs(
    apiSlips.map((slip) =>
      buildLttpIssueSlipPrintJob(collectLttpIssueSlipPrintParamsFromApiSlip(slip)),
    ),
  );
}
