import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { completeMenuJson } from "../kitchen-books/kitchen-books-menu-ai-llm.js";
import { buildDraftPatchPrompt } from "./lttp-issue-slip-ai-extract.js";
import { getIssueSlipAiDraft, lockDraft } from "./lttp-issue-slip-ai-draft.js";
import { normalizeRuleSuggestion, validateAndResolvePatch } from "./lttp-issue-slip-ai-draft-patch.js";

function draftChatError(error) {
  if (error instanceof AppError) throw error;
  throw new AppError({
    message: "Giữ nguyên bản nháp. Hãy thử lại hoặc dùng nút chọn.",
    statusCode: 502,
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
  });
}

async function loadPatchContext(prisma, draft, tickedLines) {
  const ids = [
    ...new Set(
      tickedLines.flatMap((line) => [
        line.commodityId,
        ...(Array.isArray(line.choices) ? line.choices.map((choice) => choice.commodityId) : []),
      ]),
    ),
  ].filter((id) => Number(id) > 0);
  const commodities = ids.length
    ? await prisma.lttpCommodity.findMany({
        where: { id: { in: ids }, unitId: draft.storageUnitId },
        include: { lttpCommodityDefaultSupplier: true },
      })
    : [];
  const rules = prisma.lttpAiUomRule
    ? await prisma.lttpAiUomRule.findMany({
        where: { recipientUnitId: draft.recipientUnitId, confirmed: true },
      })
    : [];
  return {
    commodities: commodities.map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      measureUnit: item.measureUnit,
      lttpSupplierId: item.lttpCommodityDefaultSupplier?.lttpSupplierId ?? null,
    })),
    rules,
  };
}

async function proposeIssueSlipAiDraftChat(prisma, input, opts = {}) {
  const draft = await getIssueSlipAiDraft(prisma, input);
  if (draft.status !== "editing") {
    throw new AppError({
      message: "Bản nháp không còn đang sửa.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const ticked = new Set((input.lineIds || []).map(Number));
  const lines = (draft.lines || []).filter((line) => ticked.has(line.id));
  if (!lines.length) {
    throw new AppError({
      message: "Chọn ít nhất một dòng để chat sửa.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const complete = opts.complete ?? completeMenuJson;
  let llm;
  try {
    llm = await complete(
      buildDraftPatchPrompt({
        rawText: draft.rawText,
        lines,
        message: input.message,
      }),
      opts.completeOpts,
    );
  } catch (error) {
    draftChatError(error);
  }
  const context = await loadPatchContext(prisma, draft, lines);
  const resolved = validateAndResolvePatch({
    ops: Array.isArray(llm?.patch) ? llm.patch : [],
    tickedIds: [...ticked],
    lines,
    commodities: context.commodities,
    rules: context.rules,
  });
  const ruleSuggestion = normalizeRuleSuggestion(llm?.rule_suggestion);
  const explanation = String(llm?.explanation || "").slice(0, 500);
  const proposedPatch = {
    ops: resolved.kept,
    dropped: resolved.dropped,
    ruleSuggestion,
    acceptRule: false,
    appliedVersion: null,
  };
  const tickedLineIds = lines.map((line) => line.id);
  await prisma.lttpAiDraftChatTurn.create({
    data: {
      draftId: draft.id,
      role: "user",
      content: String(input.message || "").slice(0, 2000),
      tickedLineIds,
      proposedPatch: null,
      applied: false,
      actorUserId: input.actorUserId || null,
    },
  });
  const turn = await prisma.lttpAiDraftChatTurn.create({
    data: {
      draftId: draft.id,
      role: "assistant",
      content: explanation,
      tickedLineIds,
      proposedPatch,
      applied: false,
      actorUserId: input.actorUserId || null,
    },
  });
  return {
    turnId: turn.id,
    explanation,
    diff: resolved.kept,
    dropped: resolved.dropped,
    ruleSuggestion,
    version: draft.version,
  };
}

async function applyProposedDraftPatch(prisma, input) {
  const current = await getIssueSlipAiDraft(prisma, input);
  const turn = (current.chatTurns || []).find(
    (row) => row.id === Number(input.turnId) && row.role === "assistant",
  );
  if (!turn || turn.applied) {
    throw new AppError({
      message: "Không có bản sửa để áp dụng.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const known = new Set((current.lines || []).map((line) => line.id));
  await lockDraft(prisma, input);
  const ops = (Array.isArray(turn.proposedPatch?.ops) ? turn.proposedPatch.ops : []).filter((op) =>
    known.has(op.lineId),
  );
  for (const op of ops) {
    const next = await prisma.lttpAiDraftLine.update({
      where: { id: op.lineId },
      data: {
        commodityId: op.after.commodityId,
        commodityName: op.after.commodityName,
        code: op.after.code,
        quantity: op.after.quantity,
        measureUnit: op.after.measureUnit,
        lttpSupplierId: op.after.lttpSupplierId,
        unitPrice: op.after.unitPrice,
        status: "edited",
      },
    });
    await prisma.lttpAiDraftLineEvent.create({
      data: {
        draftLineId: op.lineId,
        source: "chat",
        beforeJson: op.before,
        afterJson: {
          commodityId: next.commodityId,
          commodityName: next.commodityName,
          quantity: Number(next.quantity),
          measureUnit: next.measureUnit,
          status: next.status,
        },
        actorUserId: input.actorUserId || null,
      },
    });
  }
  const appliedVersion = Number(input.version) + 1;
  await prisma.lttpAiDraftChatTurn.update({
    where: { id: turn.id },
    data: {
      applied: true,
      proposedPatch: {
        ...turn.proposedPatch,
        acceptRule: Boolean(input.acceptRule && turn.proposedPatch?.ruleSuggestion),
        appliedVersion,
      },
    },
  });
  return getIssueSlipAiDraft(prisma, input);
}

async function undoLastDraftChatApply(prisma, input) {
  const draft = await getIssueSlipAiDraft(prisma, input);
  const turn = [...(draft.chatTurns || [])]
    .reverse()
    .find((row) => row.role === "assistant" && row.applied);
  if (!turn || turn.proposedPatch?.appliedVersion !== draft.version) {
    throw new AppError({
      message: "Không hoàn tác được vì đã có sửa mới hơn.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  await lockDraft(prisma, input);
  const ops = Array.isArray(turn.proposedPatch?.ops) ? turn.proposedPatch.ops : [];
  for (const op of ops) {
    await prisma.lttpAiDraftLine.update({
      where: { id: op.lineId },
      data: {
        commodityId: op.before.commodityId,
        commodityName: op.before.commodityName,
        code: op.before.code,
        quantity: op.before.quantity,
        measureUnit: op.before.measureUnit,
        lttpSupplierId: op.before.lttpSupplierId,
        unitPrice: op.before.unitPrice,
        status: op.before.status,
      },
    });
    await prisma.lttpAiDraftLineEvent.create({
      data: {
        draftLineId: op.lineId,
        source: "chat",
        beforeJson: op.after,
        afterJson: op.before,
        actorUserId: input.actorUserId || null,
      },
    });
  }
  await prisma.lttpAiDraftChatTurn.update({
    where: { id: turn.id },
    data: {
      applied: false,
      proposedPatch: { ...turn.proposedPatch, appliedVersion: null, acceptRule: false },
    },
  });
  return getIssueSlipAiDraft(prisma, input);
}

export { applyProposedDraftPatch, proposeIssueSlipAiDraftChat, undoLastDraftChatApply };
