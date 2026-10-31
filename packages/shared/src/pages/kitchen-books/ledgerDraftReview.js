/** Bản nháp trợ lý. Bỏ thì không ghi. Chấp nhận chỉ giữ dòng được phép, cùng lối nhập tay. */

const RICE_COLUMNS = new Set(["G", "H", "I", "J"]);

function allowedColumn(line) {
  const source = line?.source || "";
  if (line?.kind === "rice") return RICE_COLUMNS.has(source);
  if (source === "G" || source === "H") return false;
  return Boolean(line?.savable);
}

function reviewDraft(action, lines) {
  if (action !== "accept") return { save: false, lines: [] };
  const accepted = (lines || []).filter((line) => line?.savable && allowedColumn(line));
  return { save: accepted.length > 0, lines: accepted };
}

export { reviewDraft, allowedColumn };
