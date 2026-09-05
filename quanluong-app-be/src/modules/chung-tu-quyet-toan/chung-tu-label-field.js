import { LABEL_FIELD_NAMED_RANGE_PREFIX, splitNamedRangePrefix } from "./chung-tu-named-range-prefix.js";

export function isLabelFieldNamedRange(name) {
  return splitNamedRangePrefix(name).prefix === LABEL_FIELD_NAMED_RANGE_PREFIX;
}

/** Gia tri ghi vao named range (mot o). */
export function formatDerivedNamedRangeValue(fieldKey, rawValue, { label } = {}) {
  const value = String(rawValue ?? "").trim();
  if (!value) return "";
  const prefix = String(label ?? "");
  const normalizedPrefix = prefix.trim();
  if (!normalizedPrefix) return value;
  if (value.startsWith(prefix) || value.startsWith(normalizedPrefix) || value.startsWith(prefix.trimEnd())) {
    return value;
  }
  return `${prefix}${value}`;
}
