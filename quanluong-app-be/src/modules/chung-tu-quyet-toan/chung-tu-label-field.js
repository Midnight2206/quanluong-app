import { LABEL_FIELD_NAMED_RANGE_PREFIX, splitNamedRangePrefix } from "./chung-tu-named-range-prefix.js";

export function isLabelFieldNamedRange(name) {
  return splitNamedRangePrefix(name).prefix === LABEL_FIELD_NAMED_RANGE_PREFIX;
}

/** Gia tri ghi vao named range (mot o). Label van giu khi value rong. */
export function formatDerivedNamedRangeValue(fieldKey, rawValue, { label } = {}) {
  const value = String(rawValue ?? "").trim();
  const prefix = String(label ?? "");
  const normalizedPrefix = prefix.trim();
  if (!value) {
    return normalizedPrefix ? prefix : "";
  }
  if (!normalizedPrefix) return value;
  if (value.startsWith(prefix) || value.startsWith(normalizedPrefix) || value.startsWith(prefix.trimEnd())) {
    return value;
  }
  return `${prefix}${value}`;
}
