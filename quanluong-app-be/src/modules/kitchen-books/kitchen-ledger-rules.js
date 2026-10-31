import { classifyItem } from "./kitchen-ledger-compute.js";

const LEDGER_ACTIONS = {
  view: "kitchenBooks.view",
  save: "kitchenBooks.save",
  lock: "kitchenBooks.lock",
  unlock: "kitchenBooks.unlock",
  settings: "kitchenBooks.settings",
  export: "kitchenBooks.export",
};

function allow() {
  return { ok: true };
}

function deny(statusCode, code, message, details) {
  return { ok: false, statusCode, code, message, details };
}

function assertManualColumn({ name, measureUnit, source, settings }) {
  if (source !== "G" && source !== "H") return allow();
  if (classifyItem(name, measureUnit, settings) === "rice") return allow();
  return deny(
    403,
    "FORBIDDEN",
    "Cột Trên BĐ chỉ lấy từ phiếu xuất cấp 1. Chỉ gạo được nhập tay vào cột này.",
  );
}

function assertLineIdentity({ sourceKind, grade }) {
  if (sourceKind !== "market" && sourceKind !== "tgsx") {
    return deny(400, "VALIDATION_ERROR", "Chưa chọn nguồn Mua TT hoặc TGSX.");
  }
  if (!String(grade || "").trim()) {
    return deny(400, "VALIDATION_ERROR", "Chưa chọn phẩm cấp.");
  }
  return allow();
}

function assertLedgerAction(actor, action) {
  if (actor?.isSuperadmin || actor?.typeCode === "superadmin") return allow();
  const code = LEDGER_ACTIONS[action];
  const permissions = Array.isArray(actor?.permissions) ? actor.permissions : [];
  if (code && permissions.includes(code)) return allow();
  return deny(403, "FORBIDDEN", "Không có quyền thực hiện thao tác này trên sổ.");
}

function assertIssueSlipDepth(depth) {
  if (Number(depth) === 0) return allow();
  return deny(403, "FORBIDDEN", "Chỉ cấp 1 được lập, sửa hoặc xóa phiếu xuất kho.");
}

function negativeItems(lines, date) {
  return (lines || []).filter((line) => line.negative).map((line) => ({
    name: line.name,
    date: date || line.date || "",
    qty: line.closingQty,
    uom: line.uom || "",
  }));
}

function lockAfterSync({ wasLocked, negatives }) {
  const list = negatives || [];
  if (wasLocked && list.length) {
    return { status: "draft", reverted: true, needsResignature: true, clearLock: true };
  }
  if (wasLocked) {
    return { status: "locked", reverted: false, needsResignature: true, clearLock: false };
  }
  return { status: "draft", reverted: false, needsResignature: false, clearLock: false };
}

function pdfStale({ pdfFingerprint, fingerprint }) {
  if (!pdfFingerprint) return false;
  return pdfFingerprint !== fingerprint;
}

function rejectReverseSlipWrite() {
  return deny(410, "GONE", "Sổ không ghi ngược số vào phiếu xuất kho.");
}

export {
  LEDGER_ACTIONS,
  assertIssueSlipDepth,
  assertLedgerAction,
  assertLineIdentity,
  assertManualColumn,
  lockAfterSync,
  negativeItems,
  pdfStale,
  rejectReverseSlipWrite,
};
