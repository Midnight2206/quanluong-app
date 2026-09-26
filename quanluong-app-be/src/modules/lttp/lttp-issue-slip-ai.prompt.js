function dateOnlyIso(d) {
  const x = d instanceof Date ? d : new Date(d);
  return x.toISOString().slice(0, 10);
}

function buildIssueSlipAiPrompt({ prompt, issueDate, catalogText, historyText, context }) {
  const system = [
    "Ban la tro ly lap phieu xuat kho LTTP quan luong Viet Nam.",
    "Chi tra ve JSON object dung schema co header va lines[].",
    "header: { issueDate?, receivedDate?, recipientUnitId?, buyerUserId?, slipNote? } (YYYY-MM-DD cho ngay).",
    "lines[]: { commodityName, code?, quantity, priceKind: market|tgsx }.",
    "Uu tien ma/ten LTTP trong danh muc don vi; toi da 2 dong/commodity (market va tgsx).",
  ].join(" ");

  const ctx = context && typeof context === "object" ? context : {};
  const userParts = [
    `Ngay xuat goi y: ${issueDate || "(chua ro)"}`,
    ctx.receivedDate ? `Ngay nhan goi y: ${ctx.receivedDate}` : null,
    ctx.recipientUnitId != null ? `Don vi nhan goi y (id): ${ctx.recipientUnitId}` : null,
    "",
    catalogText,
    "",
    "Mau phieu xuat gan day:",
    historyText,
    "",
    "Mo ta nguoi dung:",
    prompt,
  ].filter((line) => line != null);

  return { system, user: userParts.join("\n") };
}

function formatIssueSlipHistoryForPrompt(slips) {
  if (!Array.isArray(slips) || slips.length === 0) {
    return "(khong co lich su)";
  }
  return slips
    .map((slip) => {
      const ymd = dateOnlyIso(slip.issueDate);
      const lineBits = (slip.lines || []).map((l) => {
        const name = l.commodity?.name || l.commodityName || "?";
        const code = l.commodity?.code ? `[${l.commodity.code}]` : "";
        const qty = l.quantity != null ? Number(l.quantity) : "?";
        const kind = l.priceKind || "market";
        return `${name}${code} x${qty} (${kind})`;
      });
      const note = slip.note ? ` | ghi chu: ${String(slip.note).slice(0, 80)}` : "";
      return `- ${ymd}: ${lineBits.join("; ") || "(khong dong)"}${note}`;
    })
    .join("\n");
}

export { buildIssueSlipAiPrompt, formatIssueSlipHistoryForPrompt };
