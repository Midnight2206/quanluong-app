function pct(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function startedNeedsConfirm(line) {
  if (line.status === "needs_confirm") return true;
  return (line.events || []).some(
    (event) => event.source === "ai" && event.afterJson?.status === "needs_confirm",
  );
}

function verdictsFor(draft, fillLog) {
  const confirmed = Array.isArray(fillLog?.confirmedJson) ? fillLog.confirmedJson : [];
  let index = 0;
  return (draft.lines || []).map((line) => {
    if (!(Number(line.commodityId) > 0)) return null;
    const row = confirmed[index] || null;
    index += 1;
    return row?.verdict || null;
  });
}

function latestFillLog(logs) {
  const rows = logs || [];
  const withVerdict = rows.filter((log) =>
    (Array.isArray(log.confirmedJson) ? log.confirmedJson : []).some((row) => row?.verdict),
  );
  const pool = withVerdict.length ? withVerdict : rows;
  return (
    [...pool].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null
  );
}

function summarizeLttpAiQuality({ drafts = [], fillLogs = [] } = {}) {
  const committed = (drafts || []).filter((draft) => draft.status === "committed");
  const logsBySlip = new Map();
  for (const log of fillLogs || []) {
    if (!log.issueSlipId) continue;
    const bucket = logsBySlip.get(log.issueSlipId) || [];
    bucket.push(log);
    logsBySlip.set(log.issueSlipId, bucket);
  }
  let lines = 0;
  let correct = 0;
  let needsConfirm = 0;
  const edited = { alias: 0, score: 0, llm: 0, other: 0 };
  let userTurns = 0;
  let llmCalls = 0;
  for (const draft of committed) {
    const verdicts = verdictsFor(draft, latestFillLog(logsBySlip.get(draft.issueSlipId)));
    const turns = draft.chatTurns || [];
    userTurns += turns.filter((turn) => turn.role === "user").length;
    const assistantTurns = turns.filter((turn) => turn.role === "assistant").length;
    let pickCalls = 0;
    (draft.lines || []).forEach((line, index) => {
      lines += 1;
      if (startedNeedsConfirm(line)) needsConfirm += 1;
      if (verdicts[index] === "ai_correct") correct += 1;
      if (verdicts[index] === "ai_wrong" || line.status === "edited") {
        const source = ["alias", "score", "llm"].includes(line.decisionSource)
          ? line.decisionSource
          : "other";
        edited[source] += 1;
      }
      if (line.decisionSource === "llm") pickCalls += 1;
    });
    // ponytail: không lưu từng lần gọi. Ước lượng = 1 lần tách tin + 1 lần chọn cho mỗi dòng nguồn llm + 1 lần cho mỗi lượt chat AI.
    llmCalls += 1 + pickCalls + assistantTurns;
  }
  const slips = committed.length;
  return {
    slips,
    lines,
    pctCorrectNoEdit: pct(correct, lines),
    pctNeedsConfirm: pct(needsConfirm, lines),
    pctEditedBySource: {
      alias: pct(edited.alias, lines),
      score: pct(edited.score, lines),
      llm: pct(edited.llm, lines),
      other: pct(edited.other, lines),
    },
    meanChatTurns: slips ? Math.round((userTurns / slips) * 10) / 10 : 0,
    meanLlmCalls: slips ? Math.round((llmCalls / slips) * 10) / 10 : 0,
  };
}

async function loadLttpAiQuality(prisma) {
  if (!prisma?.lttpAiOrderDraft) return { drafts: [], fillLogs: [] };
  const drafts = await prisma.lttpAiOrderDraft.findMany({
    where: { status: "committed" },
    include: {
      lines: {
        orderBy: { sortOrder: "asc" },
        include: { events: { orderBy: { createdAt: "asc" } } },
      },
      chatTurns: true,
    },
  });
  const slipIds = drafts.map((draft) => draft.issueSlipId).filter((id) => Number(id) > 0);
  const fillLogs =
    slipIds.length && prisma.lttpAiFillLog
      ? await prisma.lttpAiFillLog.findMany({ where: { issueSlipId: { in: slipIds } } })
      : [];
  return { drafts, fillLogs };
}

export { loadLttpAiQuality, summarizeLttpAiQuality };
