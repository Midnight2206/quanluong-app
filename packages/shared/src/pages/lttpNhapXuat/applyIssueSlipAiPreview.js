import {
  LTTP_ISSUE_SLIP_PRICE_KIND,
  normalizeIssueSlipPriceKind,
} from "./lttpIssueSlipPriceKind.js";

const TOUCHED_HEADER_KEYS = [
  "issueDate",
  "receivedDate",
  "recipientUnitId",
  "buyerUserId",
  "slipNote",
];

function headerValuePresent(value) {
  return value != null && value !== "";
}

function buildHeaderPatch(headerDraft, touched) {
  const draft = headerDraft && typeof headerDraft === "object" ? headerDraft : {};
  const marks = touched && typeof touched === "object" ? touched : {};
  /** @type {Record<string, unknown>} */
  const patch = {};

  for (const key of TOUCHED_HEADER_KEYS) {
    if (marks[key]) {
      continue;
    }
    const value = draft[key];
    if (headerValuePresent(value)) {
      patch[key] = value;
    }
  }

  if (!marks.recipientUnitId && headerValuePresent(draft.recipientDisplayName)) {
    patch.recipientDisplayName = draft.recipientDisplayName;
  }
  if (!marks.buyerUserId && headerValuePresent(draft.buyerDisplayName)) {
    patch.buyerDisplayName = draft.buyerDisplayName;
  }

  return patch;
}

function isApplicablePreviewLine(line) {
  if (!line || line.mapped !== true) {
    return false;
  }
  const commodityId = Number(line.commodityId);
  if (!Number.isInteger(commodityId) || commodityId <= 0) {
    return false;
  }
  const quantity = Number(line.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return false;
  }
  const priceKind = normalizeIssueSlipPriceKind(line.priceKind);
  if (
    priceKind !== LTTP_ISSUE_SLIP_PRICE_KIND.MARKET &&
    priceKind !== LTTP_ISSUE_SLIP_PRICE_KIND.TGSX
  ) {
    return false;
  }
  const supplierId = Number(line.lttpSupplierId);
  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    return false;
  }
  return true;
}

function finitePriceOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mapPreviewLineToRow(line, newEmptyRow) {
  const base = newEmptyRow();
  const quantity = Number(line.quantity);
  return {
    ...base,
    commodityId: String(line.commodityId),
    codeDraft: line.code != null ? String(line.code) : "",
    lttpSupplierId: String(line.lttpSupplierId),
    quantity: String(quantity),
    unitPrice: finitePriceOrNull(line.unitPrice),
    tgsxPrice: finitePriceOrNull(line.tgsxPrice),
    priceKind: normalizeIssueSlipPriceKind(line.priceKind),
    lineNote: "",
  };
}

/**
 * Pure merge: AI preview → form header patch + replacement line rows.
 *
 * @param {{
 *   header?: object,
 *   touched?: Record<string, boolean>,
 *   preview?: { headerDraft?: object, lines?: object[] },
 *   newEmptyRow: () => object,
 * }} params
 * @returns {{ headerPatch: object, nextRows: object[], appliedCount: number, skippedCount: number }}
 */
export function applyIssueSlipAiPreview({ header, touched, preview, newEmptyRow }) {
  void header;
  const lines = Array.isArray(preview?.lines) ? preview.lines : [];
  const headerPatch = buildHeaderPatch(preview?.headerDraft, touched);

  const applicable = lines.filter(isApplicablePreviewLine);
  const appliedCount = applicable.length;
  const skippedCount = lines.length - appliedCount;

  const nextRows =
    appliedCount > 0
      ? applicable.map((line) => mapPreviewLineToRow(line, newEmptyRow))
      : [newEmptyRow()];

  return { headerPatch, nextRows, appliedCount, skippedCount };
}
