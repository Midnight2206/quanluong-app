import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { normalizeCommodityName } from "../kitchen-books/kitchen-books-menu-ai-map.js";
import { getIssueSlipAiDraft, lockDraft } from "./lttp-issue-slip-ai-draft.js";
import { confirmUomRule, learnConfirmedOrder } from "./lttp-issue-slip-ai-learn.js";

function lineLearnWeight(line, confirmAll) {
  if (line?.status === "needs_confirm") return null;
  if (line?.status === "edited") return { aliasWeight: 3, verdict: "ai_wrong" };
  if (confirmAll) return { aliasWeight: 1, verdict: "ai_correct" };
  return { aliasWeight: 0, verdict: "untouched" };
}

function editSourceOf(lineId, events) {
  const edits = (events || []).filter((event) => event.draftLineId === lineId && event.source !== "ai");
  return edits.length ? edits[edits.length - 1].source : null;
}

function aiLineOf(line, events) {
  const first = (events || []).find((event) => event.draftLineId === line.id && event.source === "ai");
  const snap = first?.afterJson || {};
  return {
    rawName: line.rawName || snap.commodityName || "",
    writtenQty: line.writtenQty,
    writtenUom: line.writtenUom,
    commodityId: snap.commodityId ?? null,
    quantity: snap.quantity ?? null,
    measureUnit: snap.measureUnit ?? null,
  };
}

async function writeAcceptedRules(prisma, draft, storageUnitId) {
  for (const turn of draft.chatTurns || []) {
    const rule = turn.proposedPatch?.ruleSuggestion;
    if (!turn.applied || !turn.proposedPatch?.acceptRule || !rule) continue;
    if (rule.type === "uom" && prisma.lttpAiUomRule) {
      await confirmUomRule({
        prisma,
        recipientUnitId: draft.recipientUnitId,
        commodityId: rule.commodityId,
        fromUom: rule.fromUom,
        factor: rule.factor,
      });
    }
    if (rule.type !== "alias" || !prisma.lttpAiAliasStat) continue;
    const commodity = await prisma.lttpCommodity.findFirst({
      where: { id: rule.commodityId, unitId: storageUnitId },
    });
    const rawNorm = normalizeCommodityName(rule.raw);
    if (!commodity || !rawNorm) continue;
    await prisma.lttpAiAliasStat.upsert({
      where: {
        recipientUnitId_rawNorm_commodityId: {
          recipientUnitId: draft.recipientUnitId,
          rawNorm,
          commodityId: rule.commodityId,
        },
      },
      create: {
        recipientUnitId: draft.recipientUnitId,
        rawNorm,
        commodityId: rule.commodityId,
        hitCount: 1,
      },
      update: { hitCount: { increment: 1 } },
    });
  }
}

async function commitIssueSlipAiDraft(prisma, input) {
  const draft = await getIssueSlipAiDraft(prisma, input);
  if (draft.status !== "editing") {
    throw new AppError({
      message: "Bản nháp không còn đang sửa.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if ((draft.lines || []).some((line) => line.status === "needs_confirm")) {
    throw new AppError({
      message: "Còn dòng cần xác nhận trước khi chốt.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const slip = await prisma.lttpIssueSlip.findUnique({
    where: { id: input.issueSlipId },
    select: { id: true, unitId: true },
  });
  if (!slip || slip.unitId !== input.storageUnitId) {
    throw new AppError({
      message: "Phiếu xuất không thuộc kho này.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const lineIds = (draft.lines || []).map((line) => line.id);
  const events =
    lineIds.length && prisma.lttpAiDraftLineEvent
      ? await prisma.lttpAiDraftLineEvent.findMany({
          where: { draftLineId: { in: lineIds } },
          orderBy: { createdAt: "asc" },
        })
      : [];
  const confirmAll = Boolean(input.confirmAll);
  const aiLines = [];
  const confirmedLines = [];
  for (const line of draft.lines || []) {
    const weight = lineLearnWeight(line, confirmAll);
    if (!weight || !(Number(line.commodityId) > 0)) continue;
    aiLines.push(aiLineOf(line, events));
    confirmedLines.push({
      commodityId: Number(line.commodityId),
      quantity: Number(line.quantity),
      measureUnit: line.measureUnit,
      rawName: line.rawName,
      aliasWeight: weight.aliasWeight,
      verdict: weight.verdict,
      editSource: editSourceOf(line.id, events),
    });
  }
  // ponytail: phiếu đã được API lưu phiếu tạo trước. Transaction này chỉ khóa bản nháp và học; lỗi thì version không tăng.
  const learned = await prisma.$transaction(async (tx) => {
    await lockDraft(tx, input);
    const result = await learnConfirmedOrder({
      prisma: tx,
      recipientUnitId: draft.recipientUnitId,
      recipientUserId: draft.recipientUserId,
      issueSlipId: input.issueSlipId,
      orderMessageId: draft.orderMessageId,
      aiLines,
      confirmedLines,
    });
    await writeAcceptedRules(tx, draft, input.storageUnitId);
    if (input.sessionId && tx.lttpIssueSlipAiMemory) {
      await tx.lttpIssueSlipAiMemory.updateMany({
        where: { sessionId: input.sessionId, unitId: input.storageUnitId },
        data: { issueSlipId: input.issueSlipId },
      });
    }
    await tx.lttpAiOrderDraft.update({
      where: { id: draft.id },
      data: { status: "committed", issueSlipId: input.issueSlipId },
    });
    return result;
  });
  return {
    draft: await getIssueSlipAiDraft(prisma, input),
    proposals: learned.proposals,
  };
}

export { commitIssueSlipAiDraft, lineLearnWeight };
