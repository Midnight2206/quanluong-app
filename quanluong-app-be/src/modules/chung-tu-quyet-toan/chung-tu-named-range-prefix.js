export const LABEL_FIELD_NAMED_RANGE_PREFIX = "FIELD_";
export const NL_FIELD_NAMED_RANGE_PREFIX = "NL_FIELD_";

export function splitNamedRangePrefix(name) {
  const raw = String(name ?? "").trim();
  if (raw.startsWith(NL_FIELD_NAMED_RANGE_PREFIX)) {
    return {
      prefix: NL_FIELD_NAMED_RANGE_PREFIX,
      fieldName: raw.slice(NL_FIELD_NAMED_RANGE_PREFIX.length),
    };
  }
  if (raw.startsWith(LABEL_FIELD_NAMED_RANGE_PREFIX)) {
    return {
      prefix: LABEL_FIELD_NAMED_RANGE_PREFIX,
      fieldName: raw.slice(LABEL_FIELD_NAMED_RANGE_PREFIX.length),
    };
  }
  return { prefix: null, fieldName: raw };
}
