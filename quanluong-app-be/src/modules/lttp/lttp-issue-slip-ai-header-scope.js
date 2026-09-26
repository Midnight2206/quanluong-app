import { AppError } from "../../errors/app-error.js";

function positiveIntOrNull(value) {
  if (value == null || value === "") {
    return null;
  }
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function tryAssert(fn) {
  try {
    await fn();
    return true;
  } catch (err) {
    if (err instanceof AppError) {
      return false;
    }
    throw err;
  }
}

function tryAssertSync(fn) {
  try {
    fn();
    return true;
  } catch (err) {
    if (err instanceof AppError) {
      return false;
    }
    throw err;
  }
}

/**
 * Same scope rules as createIssueSlip; invalid / uncertain → null + warning (no throw).
 * Caller must supply assert helpers (see lttp-issue-slip-ai.service.js).
 */
async function scopeSanitizeIssueSlipAiHeaderDraft(headerDraft, ctx) {
  const warnings = ctx.warnings;
  const { assertUnitInBranch, assertBuyer, assertRecipientUser } = ctx.deps;
  if (!assertUnitInBranch || !assertBuyer || !assertRecipientUser) {
    throw new Error("scopeSanitizeIssueSlipAiHeaderDraft requires ctx.deps assert helpers");
  }

  const out = { ...headerDraft };

  const requestRid = positiveIntOrNull(ctx.requestRecipientUnitId);
  if (out.recipientUnitId == null && requestRid != null) {
    if (tryAssertSync(() => assertUnitInBranch(requestRid, ctx.effectiveUnitIds))) {
      out.recipientUnitId = requestRid;
    } else {
      warnings.push("Đơn vị nhận trong yêu cầu ngoài phạm vi — bỏ qua.");
    }
  }

  if (out.recipientUnitId != null) {
    if (!tryAssertSync(() => assertUnitInBranch(out.recipientUnitId, ctx.effectiveUnitIds))) {
      warnings.push("Đơn vị nhận gợi ý ngoài phạm vi — bỏ qua.");
      out.recipientUnitId = null;
      out.recipientDisplayName = null;
      out.recipientUserId = null;
    }
  } else {
    out.recipientDisplayName = null;
    out.recipientUserId = null;
  }

  if (out.recipientUserId != null) {
    const ruId = out.recipientUserId;
    if (out.recipientUnitId == null) {
      warnings.push("Người nhận gợi ý không có đơn vị nhận hợp lệ — bỏ qua.");
      out.recipientUserId = null;
      out.recipientDisplayName = null;
    } else if (!(await tryAssert(() => assertRecipientUser(ruId, out.recipientUnitId)))) {
      warnings.push("Người nhận gợi ý không thuộc đơn vị nhận — bỏ qua.");
      out.recipientUserId = null;
      out.recipientDisplayName = null;
    }
  }

  if (out.buyerUserId != null) {
    const buId = out.buyerUserId;
    if (!(await tryAssert(() => assertBuyer(buId, ctx.storageUnitId)))) {
      warnings.push("Người mua gợi ý không thuộc phạm vi kho — bỏ qua.");
      out.buyerUserId = null;
      out.buyerDisplayName = null;
    }
  } else {
    out.buyerDisplayName = null;
  }

  return out;
}

export { scopeSanitizeIssueSlipAiHeaderDraft, positiveIntOrNull };
