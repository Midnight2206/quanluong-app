/** Sắp xếp đơn vị theo materialized path (cây phẳng đúng thứ tự cấp). */
export function sortUnitsByMaterializedPath(units) {
  return [...(units || [])].sort((a, b) => (a.path || "").localeCompare(b.path || ""));
}

/** Nhãn select: thụt theo `depth` (0 = gốc trong phạm vi). */
export function formatUnitOptionLabel(unit) {
  const depth = typeof unit.depth === "number" ? unit.depth : 0;
  const indent = `${"—".repeat(Math.min(depth + 1, 10))}${depth >= 0 ? " " : ""}`;
  return `${indent}${unit.name ?? ""}`.trim();
}
