import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { lineNoteForItem, quantityTokenForConvert } from "./lttp-issue-slip-ai-line-note.js";
import { loadConfirmedQtyRules, loadOriginalQtyOnConvert } from "./lttp-issue-slip-ai-learn.js";
import { bindSharedQtyRules, convertQuantity } from "./lttp-issue-slip-ai-uom.js";

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
    parenText: line.parenText ? String(line.parenText).slice(0, 500) : null,
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
  const originalQtyOnConvert = await loadOriginalQtyOnConvert(prisma, storageUnitId);
  const commodityIds = [
    ...new Set((draft.lines || []).map((line) => Number(line.commodityId)).filter((lineId) => lineId > 0)),
  ];
  const stockUomByCommodityId =
    commodityIds.length && prisma?.lttpCommodity?.findMany
      ? new Map(
          (
            await prisma.lttpCommodity.findMany({
              where: { id: { in: commodityIds }, unitId: storageUnitId },
              select: { id: true, measureUnit: true },
            })
          ).map((commodity) => [commodity.id, commodity.measureUnit || null]),
        )
      : new Map();
  draft.lines = (draft.lines || []).map((line) => ({
    ...line,
    lineNote: lineNoteForItem({
      writtenQty: line.writtenQty,
      writtenUom: line.writtenUom,
      parenText: line.parenText,
      stockUom: stockUomByCommodityId.get(Number(line.commodityId)) || line.measureUnit || null,
      originalQtyOnConvert,
    }).lineNote,
  }));
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

async function quantityForChosenSku(prisma, draft, stored, commodity) {
  const rules = bindSharedQtyRules(
    await loadConfirmedQtyRules(prisma, draft?.recipientUnitId, draft?.storageUnitId),
    [commodity],
  );
  let habitUom = null;
  if (prisma.lttpAiCommodityHabit?.findMany && draft?.recipientUnitId) {
    const habits = await prisma.lttpAiCommodityHabit.findMany({
      where: { recipientUnitId: draft.recipientUnitId, commodityId: commodity.id },
    });
    habitUom =
      habits.sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0))[0]?.measureUnit || null;
  }
  return convertQuantity({
    writtenQty: quantityTokenForConvert(stored.writtenQty ?? stored.quantity),
    writtenUom: stored.writtenUom,
    stockUom: commodity.measureUnit,
    habitUom,
    commodityId: commodity.id,
    rules,
  });
}

async function updateIssueSlipAiDraftLine(prisma, input) {
  const draft = await lockDraft(prisma, input);
  const stored = await prisma.lttpAiDraftLine.findFirst({
    where: { id: input.lineId, draftId: input.id },
  });
  if (!stored) notFound();
  let commodity = null;
  if (input.commodityId) {
    commodity = await prisma.lttpCommodity.findFirst({
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
  let quantity = input.quantity == null ? stored.quantity : input.quantity;
  let measureUnit = input.measureUnit === undefined ? stored.measureUnit : input.measureUnit;
  let status = "edited";
  let qtyMeta = null;
  if (commodity) {
    const converted = await quantityForChosenSku(prisma, draft, stored, commodity);
    qtyMeta = {
      qtySource: converted.source,
      qtyFactor: converted.factor ?? null,
      qtyFromUom: converted.fromUom || null,
      stockUom: commodity.measureUnit || null,
      askRule: converted.source === "unknown-uom",
    };
    if (converted.source === "unknown-uom") {
      status = "needs_confirm";
      const written = Number(String(stored.writtenQty ?? "").replace(",", "."));
      quantity = written > 0 ? written : stored.quantity;
      measureUnit = stored.writtenUom || commodity.measureUnit;
    } else if (converted.quantity > 0) {
      quantity = converted.quantity;
      measureUnit = converted.measureUnit || commodity.measureUnit;
    }
  }
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
      measureUnit,
      lttpSupplierId: input.lttpSupplierId === undefined ? stored.lttpSupplierId : input.lttpSupplierId,
      unitPrice: input.unitPrice === undefined ? stored.unitPrice : input.unitPrice,
      status,
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
  const draftOut = await getIssueSlipAiDraft(prisma, { id: input.id, storageUnitId: input.storageUnitId });
  if (qtyMeta) {
    const line = (draftOut?.lines || []).find((item) => item.id === stored.id);
    if (line) Object.assign(line, qtyMeta);
  }
  return draftOut;
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
