import { enqueueOutboxItem } from "../../outbox/enqueue.js";
import {
  OP_LTTP_ISSUE_SLIP_CREATE,
  OP_LTTP_ISSUE_SLIP_UPDATE,
} from "../../outbox/operations.js";

export const LTTP_ISSUE_SLIPS_URL = "/lttp/issue-slips";

/** Network / 5xx — eligible for outbox enqueue; 4xx stays online-only error. */
export function isOutboxEligibleError(err) {
  const status = err?.status;
  if (status == null) {
    return true;
  }
  return status >= 500;
}

/**
 * @param {Record<string, unknown>|null|undefined} slip
 */
export function issueSlipBaseVersion(slip) {
  if (slip == null) {
    return null;
  }
  if (slip.version != null) {
    return slip.version;
  }
  if (slip.updatedAt != null) {
    return String(slip.updatedAt);
  }
  return slip.id != null ? String(slip.id) : null;
}

function issueSlipUrl(slipId) {
  return `${LTTP_ISSUE_SLIPS_URL}/${slipId}`;
}

/**
 * @param {import("dexie").Dexie} db
 * @param {string|number} userId
 * @param {Record<string, unknown>} body
 */
export async function enqueueLttpIssueSlipCreate(db, userId, body) {
  return enqueueOutboxItem(db, {
    userId,
    operation: OP_LTTP_ISSUE_SLIP_CREATE,
    payload: {
      url: LTTP_ISSUE_SLIPS_URL,
      method: "post",
      body,
    },
  });
}

/**
 * @param {import("dexie").Dexie} db
 * @param {string|number} userId
 * @param {string|number} slipId
 * @param {Record<string, unknown>} body
 * @param {string|number|null} baseVersion
 */
export async function enqueueLttpIssueSlipUpdate(db, userId, slipId, body, baseVersion) {
  const url = issueSlipUrl(slipId);
  return enqueueOutboxItem(db, {
    userId,
    entityId: String(slipId),
    operation: OP_LTTP_ISSUE_SLIP_UPDATE,
    baseVersion,
    payload: {
      url,
      refetchUrl: url,
      method: "put",
      body,
    },
  });
}

/**
 * @param {import("../../outbox/operations.js").OutboxItem} item
 * @param {(opts: Record<string, unknown>) => Promise<unknown>} apiRequest
 */
export async function refetchLttpIssueSlipForOutbox(item, apiRequest) {
  if (item.operation !== OP_LTTP_ISSUE_SLIP_UPDATE) {
    return null;
  }
  const slipId =
    item.entityId ??
    (() => {
      const url = item.payload?.refetchUrl ?? item.payload?.url;
      if (typeof url !== "string") {
        return null;
      }
      const m = url.match(/\/lttp\/issue-slips\/(\d+)/);
      return m?.[1] ?? null;
    })();
  if (slipId == null) {
    return null;
  }
  const data = await apiRequest({ url: issueSlipUrl(slipId), method: "get" });
  return data && typeof data === "object" ? /** @type {Record<string, unknown>} */ (data) : null;
}

/**
 * @param {(opts: Record<string, unknown>) => Promise<unknown>} apiRequest
 */
export function createLttpOutboxHandlers(apiRequest) {
  return {
    refetchEntity: (item) => refetchLttpIssueSlipForOutbox(item, apiRequest),
  };
}

// TODO: LTTP offline upload/import — no blob upload or excel import endpoints wired for issue slips yet.
