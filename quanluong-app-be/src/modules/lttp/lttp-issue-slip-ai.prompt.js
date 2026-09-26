function dateOnlyIso(d) {
  const x = d instanceof Date ? d : new Date(d);
  return x.toISOString().slice(0, 10);
}

function buildIssueSlipAiSystemPrompt() {
  return [
    "Ban la tro ly lap phieu xuat kho LTTP quan luong Viet Nam.",
    "Chi tra ve JSON object dung schema co header va lines[].",
    "header: { issueDate?, receivedDate?, recipientUnitId?, buyerUserId?, slipNote? } (YYYY-MM-DD cho ngay).",
    "lines[]: { commodityName, code?, quantity, priceKind: market|tgsx }.",
    "Mac dinh priceKind=market (gia mua TT). Chi dung tgsx khi nguoi dung noi ro TGSX/gia san xuat.",
    "Chap nhan mo ta tieng Viet khong chuan: suy ra ten/ma LTTP + so luong; uu tien khop danh muc don vi.",
    "Toi da 2 dong/commodity (market va tgsx).",
  ].join(" ");
}

function formatTurnsForPrompt(turns) {
  const rows = Array.isArray(turns) ? turns : [];
  if (!rows.length) {
    return "(chua co hoi thoai)";
  }
  return rows
    .map((turn) => {
      const role = String(turn?.role ?? "user").trim() || "user";
      const text = String(turn?.text ?? "")
        .replace(/\s+/g, " ")
        .trim();
      return `${role}: ${text || "(trong)"}`;
    })
    .join("\n");
}

function buildIssueSlipAiPrompt({ prompt, issueDate, catalogText, memoryText, historyText, context }) {
  const system = buildIssueSlipAiSystemPrompt();
  const ctx = context && typeof context === "object" ? context : {};
  const userParts = [
    `Ngay xuat goi y: ${issueDate || "(chua ro)"}`,
    ctx.receivedDate ? `Ngay nhan goi y: ${ctx.receivedDate}` : null,
    ctx.recipientUnitId != null ? `Don vi nhan goi y (id): ${ctx.recipientUnitId}` : null,
    "",
    catalogText,
    memoryText ? "" : null,
    memoryText ? "Bai hoc AI gan day:" : null,
    memoryText || null,
    "",
    "Mau phieu xuat gan day:",
    historyText,
    "",
    "Mo ta nguoi dung:",
    prompt,
  ].filter((line) => line != null);

  return { system, user: userParts.join("\n") };
}

function buildIssueSlipAiChatPrompt({ message, currentPreview, turns, catalogText, memoryText }) {
  const system = buildIssueSlipAiSystemPrompt();
  const userParts = [
    catalogText,
    memoryText ? "" : null,
    memoryText ? "Bai hoc AI gan day:" : null,
    memoryText || null,
    "",
    "Preview hien tai:",
    JSON.stringify(currentPreview ?? {}, null, 2),
    "",
    "Hoi thoai hien tai:",
    formatTurnsForPrompt(turns),
    "",
    "Tin nhan moi:",
    String(message ?? "").trim(),
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

export { buildIssueSlipAiChatPrompt, buildIssueSlipAiPrompt, formatIssueSlipHistoryForPrompt };
