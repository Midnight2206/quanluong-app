export const LTTP_PRINT_FONT_CHOICES = [
  { id: "system", label: "Hệ thống", value: "system-ui, sans-serif" },
  {
    id: "times",
    label: "Times New Roman",
    value: "'Times New Roman', Times, serif",
  },
  { id: "arial", label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { id: "georgia", label: "Georgia", value: "Georgia, serif" },
];

export const FORM_FIELD_DEFAULTS = {
  printHeaderLine1: "",
  printHeaderLine2: "Quân nhu",
  formMauSo: "Mẫu SS14-QN10",
  warehouseFrom: "Quân nhu",
  signerWriter: "",
  signerApprover: "",
  marginTop: 2,
  marginRight: 1.5,
  marginBottom: 1.5,
  marginLeft: 3,
  printFontId: "times",
  printFontSizePt: 12,
};

export function resolveLttpPrintFont(printFontId) {
  return (
    LTTP_PRINT_FONT_CHOICES.find((f) => f.id === printFontId) ??
    LTTP_PRINT_FONT_CHOICES.find((f) => f.id === "times") ??
    LTTP_PRINT_FONT_CHOICES[0]
  );
}

/** Cỡ chữ in (pt) — chuẩn hoá 8–18, mặc định 12. */
export function coercePrintFontSizePt(
  value,
  fallback = FORM_FIELD_DEFAULTS.printFontSizePt,
) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(18, Math.max(8, n));
}

export function coercePrintFontId(
  value,
  fallback = FORM_FIELD_DEFAULTS.printFontId,
) {
  const id = value != null ? String(value).trim() : "";
  if (id && LTTP_PRINT_FONT_CHOICES.some((f) => f.id === id)) {
    return id;
  }
  return fallback;
}
