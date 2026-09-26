import { LTTP_ISSUE_SLIP_PRICE_KIND } from "./lttp.constants.js";

const TGSX_DROP_WARNING = "Đã bỏ dòng TGSX vì mô tả không nêu TGSX.";

function normalizeSignalText(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizedTextHasTgsxSignal(normalized) {
  if (/\btgsx\b/.test(normalized)) {
    return true;
  }
  if (/\btg\s+sx\b/.test(normalized)) {
    return true;
  }
  if (normalized.includes("tieu chuan")) {
    return true;
  }
  if (normalized.includes("gia san xuat")) {
    return true;
  }
  return false;
}

/** @param {string[]} texts */
export function hasTgsxSignal(texts) {
  const list = Array.isArray(texts) ? texts : [];
  return list.some((t) => normalizedTextHasTgsxSignal(normalizeSignalText(t)));
}

/**
 * @param {{ lines: object[], signalTexts: string[], warnings?: string[] }} args
 * @returns {{ lines: object[], warnings: string[] }}
 */
export function dropTgsxUnlessSignaled({ lines, signalTexts, warnings }) {
  const outWarnings = Array.isArray(warnings) ? [...warnings] : [];
  const srcLines = Array.isArray(lines) ? lines : [];

  if (hasTgsxSignal(signalTexts)) {
    return { lines: srcLines, warnings: outWarnings };
  }

  const filtered = srcLines.filter(
    (line) => line?.priceKind !== LTTP_ISSUE_SLIP_PRICE_KIND.TGSX,
  );
  if (filtered.length < srcLines.length) {
    outWarnings.push(TGSX_DROP_WARNING);
  }
  return { lines: filtered, warnings: outWarnings };
}
