function infraAlertLines(report) {
  const lines = [];
  const disk = report?.disk;
  if (disk?.status === "warn" || disk?.status === "down") {
    lines.push(String(disk.message ?? ""));
  }
  for (const row of report?.containers ?? []) {
    if (row?.status === "warn" || row?.status === "down") {
      lines.push(`${row.name}: ${row.message ?? ""}`);
    }
  }
  return lines;
}

export { infraAlertLines };
