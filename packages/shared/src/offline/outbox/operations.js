/** @typedef {'pending'|'syncing'|'needs_review'|'conflict'|'synced'|'failed'} OutboxStatus */

/**
 * @typedef {Object} OutboxItem
 * @property {string} id
 * @property {number} userId
 * @property {string} idempotencyKey
 * @property {string} [entityId]
 * @property {string} operation
 * @property {Record<string, unknown>} payload
 * @property {Blob|null} [fileBlob]
 * @property {string|number|null} [baseVersion]
 * @property {OutboxStatus} status
 * @property {number} retryCount
 * @property {number} maxRetries
 * @property {string|null} [lastError]
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export const OP_CREATE_ORDER = "create_order";
export const OP_UPDATE_STATUS = "update_status";
export const OP_CANCEL = "cancel";
export const OP_ADD_ITEM = "add_item";
export const OP_UPLOAD_IMAGE = "upload_image";
export const OP_IMPORT_EXCEL = "import_excel";
export const OP_LTTP_ISSUE_SLIP_CREATE = "lttp.issue_slip.create";
export const OP_LTTP_ISSUE_SLIP_UPDATE = "lttp.issue_slip.update";

export const OUTBOX_STATUSES = [
  "pending",
  "syncing",
  "needs_review",
  "conflict",
  "synced",
  "failed",
];

const CREATE_LIKE = new Set([
  OP_CREATE_ORDER,
  OP_UPLOAD_IMAGE,
  OP_IMPORT_EXCEL,
  OP_LTTP_ISSUE_SLIP_CREATE,
]);

const UPDATE_LIKE = new Set([
  OP_UPDATE_STATUS,
  OP_CANCEL,
  OP_ADD_ITEM,
  OP_LTTP_ISSUE_SLIP_UPDATE,
]);

/** @param {string} operation */
export function isAutoRetryOperation(operation) {
  if (CREATE_LIKE.has(operation)) {
    return true;
  }
  return String(operation).startsWith("create_");
}

/** @param {string} operation */
export function isVersionedUpdateOperation(operation) {
  if (UPDATE_LIKE.has(operation)) {
    return true;
  }
  return String(operation).startsWith("update_");
}

export const DEFAULT_MAX_RETRIES = 5;
