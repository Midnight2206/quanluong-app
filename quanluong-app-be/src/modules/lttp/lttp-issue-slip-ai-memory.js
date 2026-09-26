function compactText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value, max) {
  const text = compactText(value);
  if (!text) {
    return "";
  }
  if (!Number.isInteger(max) || max <= 0 || text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(max - 1, 1)).trimEnd()}...`;
}

function formatMemoryLines(finalPreview) {
  const rows = Array.isArray(finalPreview?.lines) ? finalPreview.lines : [];
  const mapped = rows
    .filter((line) => line?.mapped)
    .map((line) => {
      const name = compactText(line.commodityName || line.name || line.code || "?");
      const quantity = line.quantity != null ? Number(line.quantity) : null;
      const priceKind = compactText(line.priceKind || "market") || "market";
      return `${name} x${Number.isFinite(quantity) ? quantity : "?"} (${priceKind})`;
    });
  return mapped.join("; ") || "(khong co dong map)";
}

function formatMemoryTurns(turns) {
  const items = Array.isArray(turns) ? turns.slice(-3) : [];
  const out = items
    .map((turn) => {
      const role = compactText(turn?.role || "user") || "user";
      const text = truncateText(turn?.text, 120);
      return text ? `${role}: ${text}` : null;
    })
    .filter(Boolean);
  return out.join(" / ") || "(khong co turns)";
}

function sortMemories(rows) {
  return [...rows].sort((a, b) => {
    const aLinked = a?.issueSlipId != null ? 1 : 0;
    const bLinked = b?.issueSlipId != null ? 1 : 0;
    if (aLinked !== bLinked) {
      return bLinked - aLinked;
    }
    const aTime = new Date(a?.updatedAt ?? 0).getTime();
    const bTime = new Date(b?.updatedAt ?? 0).getTime();
    return bTime - aTime;
  });
}

function formatMemoriesForPrompt(rows, { max = 20 } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return "(khong co memory)";
  }

  const take = Math.min(Math.max(Number(max) || 20, 1), 20);
  return sortMemories(rows)
    .slice(0, take)
    .map((row) => {
      const prompt = truncateText(row?.prompt, 200) || "(khong co prompt)";
      const lines = formatMemoryLines(row?.finalPreview);
      const turns = formatMemoryTurns(row?.turns);
      return `- prompt: "${prompt}" | lines: ${lines} | turns: ${turns}`;
    })
    .join("\n");
}

export { formatMemoriesForPrompt };
