import {
  resolveColumnFieldKey,
  resolveScalarFieldKey,
} from "./chung-tu-pdf-column-alias.util.js";

export function camelToSnake(key) {
  return String(key ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/-/g, "_")
    .toLowerCase();
}

function valueToCell(value) {
  if (value == null) return "";
  return String(value);
}

function lookupContextValue(context, templateKey) {
  if (Object.prototype.hasOwnProperty.call(context, templateKey)) {
    return context[templateKey];
  }
  for (const [k, v] of Object.entries(context)) {
    if (k === "detailRows" || k === "sheetContexts") continue;
    if (camelToSnake(k) === templateKey) return v;
  }
  return undefined;
}

export function pickMappedFields(context, fieldKeys) {
  const out = {};
  for (const key of fieldKeys) {
    const fieldKey = resolveScalarFieldKey(key);
    const raw = fieldKey
      ? lookupContextValue(context, fieldKey) ?? lookupContextValue(context, camelToSnake(fieldKey))
      : lookupContextValue(context, key);
    if (raw !== undefined) out[key] = valueToCell(raw);
  }
  return out;
}

export function mapDetailRowsForTemplate(detailRows, templateColumnKeys) {
  const rows = Array.isArray(detailRows) ? detailRows : [];
  return rows.map((row) => {
    const mapped = {};
    for (const templateKey of templateColumnKeys ?? []) {
      const fieldKey = resolveColumnFieldKey(templateKey);
      const raw = fieldKey
        ? lookupContextValue(row, fieldKey) ?? lookupContextValue(row, camelToSnake(fieldKey))
        : lookupContextValue(row, templateKey);
      mapped[templateKey] = valueToCell(raw ?? "");
    }
    return mapped;
  });
}

export const mapDetailRows = mapDetailRowsForTemplate;

export function buildDocumentServicePayload({
  context,
  fieldKeys,
  columnKeys,
  signatures = {},
  signatureDates = {},
  signatureBlock,
}) {
  const payload = {
    fields: pickMappedFields(context ?? {}, fieldKeys ?? []),
    rows: mapDetailRowsForTemplate(context?.detailRows, columnKeys ?? []),
    signatures: signatures ?? {},
    signature_dates: signatureDates ?? {},
  };
  if (signatureBlock) payload.signature_block = signatureBlock;
  return payload;
}
