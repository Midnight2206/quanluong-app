import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

function initialLineStatus(line) {
  return line?.needsConfirm ? "needs_confirm" : "sure";
}

function lineSnapshot(line) {
  return {
    commodityId: line.commodityId ?? null,
    commodityName: line.commodityName ?? null,
    code: line.code ?? null,
    quantity: line.quantity == null ? null : Number(line.quantity),
    measureUnit: line.measureUnit ?? null,
    status: line.status,
    lttpSupplierId: line.lttpSupplierId ?? null,
    unitPrice: line.unitPrice == null ? null : Number(line.unitPrice),
    priceKind: line.priceKind ?? "market",
  };
}

function buildDraftLineData(line, index) {
  return {
    sortOrder: index,
    commodityId: line.commodityId || null,
    commodityName: line.commodityName || line.rawName || null,
    code: line.code || null,
    quantity: line.quantity == null ? null : line.quantity,
    measureUnit: line.measureUnit || null,
    status: initialLineStatus(line),
    decisionSource: String(line.source || "none").slice(0, 16),
    confidence: Number(line.confidence) || 0,
    rawName: String(line.rawName || "").slice(0, 255),
    writtenQty: line.writtenQty == null ? null : String(line.writtenQty).slice(0, 64),
    writtenUom: line.writtenUom ? String(line.writtenUom).slice(0, 64) : null,
    choices: Array.isArray(line.choices) ? line.choices : [],
    lttpSupplierId: line.lttpSupplierId || null,
    unitPrice: line.unitPrice == null ? null : line.unitPrice,
    priceKind: line.priceKind || "market",
  };
}

function conflict() {
  throw new AppError({
    message: "Bản nháp đã được sửa ở nơi khác. Hãy tải lại.",
    statusCode: 409,
    code: ERROR_CODES.CONFLICT,
  });
}

function notFound() {
  throw new AppError({
    message: "Không tìm thấy bản nháp AI.",
    statusCode: 404,
    code: ERROR_CODES.NOT_FOUND,
  });
}

async function lockDraft(prisma, { id, version, storageUnitId }) {
  const draft = await prisma.lttpAiOrderDraft.findUnique({ where: { id } });
  if (!draft || draft.storageUnitId !== storageUnitId) notFound();
  if (draft.status !== "editing") {
    throw new AppError({
      message: "Bản nháp không còn đang sửa.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const locked = await prisma.lttpAiOrderDraft.updateMany({
    where: { id, version, status: "editing", storageUnitId },
    data: { version: { increment: 1 } },
  });
  if (!locked.count) conflict();
  return draft;
}

async function createIssueSlipAiDraft(prisma, input) {
  if (!prisma?.lttpAiOrderDraft || !input.recipientUnitId) return null;
  const draft = await prisma.lttpAiOrderDraft.create({
    data: {
      storageUnitId: input.storageUnitId,
      recipientUnitId: input.recipientUnitId,
      recipientUserId: input.recipientUserId || null,
      orderMessageId: input.orderMessageId || null,
      rawText: input.rawText,
      status: "editing",
      version: 1,
      createdById: input.actorUserId,
      lines: {
        create: (input.lines || []).map(buildDraftLineData),
      },
    },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (draft.lines.length && prisma.lttpAiDraftLineEvent) {
    await prisma.lttpAiDraftLineEvent.createMany({
      data: draft.lines.map((line) => ({
        draftLineId: line.id,
        source: "ai",
        beforeJson: null,
        afterJson: lineSnapshot(line),
        actorUserId: input.actorUserId,
      })),
    });
  }
  return draft;
}

async function getIssueSlipAiDraft(prisma, { id, storageUnitId }) {
  const draft = await prisma.lttpAiOrderDraft.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      chatTurns: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!draft || draft.storageUnitId !== storageUnitId) notFound();
  return draft;
}

async function listEditingIssueSlipAiDrafts(prisma, { storageUnitId, recipientUnitId, recipientUserId }) {
  return prisma.lttpAiOrderDraft.findMany({
    where: {
      storageUnitId,
      status: "editing",
      ...(recipientUnitId ? { recipientUnitId } : {}),
      ...(recipientUserId ? { recipientUserId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 30,
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
}

async function updateIssueSlipAiDraftLine(prisma, input) {
  await lockDraft(prisma, input);
  const stored = await prisma.lttpAiDraftLine.findFirst({
    where: { id: input.lineId, draftId: input.id },
  });
  if (!stored) notFound();
  if (input.commodityId) {
    const commodity = await prisma.lttpCommodity.findFirst({
      where: { id: input.commodityId, unitId: input.storageUnitId },
    });
    if (!commodity) {
      throw new AppError({
        message: "SKU không có trong danh mục kho.",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
  }
  const quantity = input.quantity == null ? stored.quantity : input.quantity;
  if (quantity != null && !(Number(quantity) > 0)) {
    throw new AppError({
      message: "Số lượng phải là số dương.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const next = await prisma.lttpAiDraftLine.update({
    where: { id: stored.id },
    data: {
      commodityId: input.commodityId === undefined ? stored.commodityId : input.commodityId,
      commodityName: input.commodityName === undefined ? stored.commodityName : input.commodityName,
      code: input.code === undefined ? stored.code : input.code,
      quantity,
      measureUnit: input.measureUnit === undefined ? stored.measureUnit : input.measureUnit,
      lttpSupplierId: input.lttpSupplierId === undefined ? stored.lttpSupplierId : input.lttpSupplierId,
      unitPrice: input.unitPrice === undefined ? stored.unitPrice : input.unitPrice,
      status: "edited",
    },
  });
  await prisma.lttpAiDraftLineEvent.create({
    data: {
      draftLineId: stored.id,
      source: input.source,
      beforeJson: lineSnapshot(stored),
      afterJson: lineSnapshot(next),
      actorUserId: input.actorUserId,
    },
  });
  return getIssueSlipAiDraft(prisma, { id: input.id, storageUnitId: input.storageUnitId });
}

async function discardIssueSlipAiDraft(prisma, input) {
  await lockDraft(prisma, input);
  await prisma.lttpAiOrderDraft.update({
    where: { id: input.id },
    data: { status: "discarded" },
  });
  return getIssueSlipAiDraft(prisma, { id: input.id, storageUnitId: input.storageUnitId });
}

export {
  buildDraftLineData,
  createIssueSlipAiDraft,
  discardIssueSlipAiDraft,
  getIssueSlipAiDraft,
  initialLineStatus,
  listEditingIssueSlipAiDrafts,
  lockDraft,
  updateIssueSlipAiDraftLine,
};
