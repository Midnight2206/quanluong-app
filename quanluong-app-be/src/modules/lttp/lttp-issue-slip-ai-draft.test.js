import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../errors/app-error.js";
import {
  createIssueSlipAiDraft,
  discardIssueSlipAiDraft,
  initialLineStatus,
  listEditingIssueSlipAiDrafts,
  updateIssueSlipAiDraftLine,
} from "./lttp-issue-slip-ai-draft.js";

function memoryPrisma() {
  const drafts = [];
  const lines = [];
  const events = [];
  let nextDraft = 1;
  let nextLine = 1;
  return {
    events,
    lttpCommodity: {
      async findFirst({ where }) {
        if (where.id === 10 && where.unitId === 9) {
          return { id: 10, unitId: 9, name: "Gạo tẻ", measureUnit: "kg" };
        }
        return null;
      },
    },
    lttpAiOrderDraft: {
      async create({ data, include }) {
        const id = nextDraft;
        nextDraft += 1;
        const row = {
          id,
          storageUnitId: data.storageUnitId,
          recipientUnitId: data.recipientUnitId,
          recipientUserId: data.recipientUserId,
          rawText: data.rawText,
          status: data.status,
          version: data.version,
          createdById: data.createdById,
          updatedAt: new Date(),
        };
        drafts.push(row);
        const created = (data.lines?.create || []).map((line) => {
          const item = { ...line, id: nextLine, draftId: id };
          nextLine += 1;
          lines.push(item);
          return item;
        });
        return include?.lines ? { ...row, lines: created } : row;
      },
      async findUnique({ where, include }) {
        const row = drafts.find((draft) => draft.id === where.id);
        if (!row) return null;
        if (!include) return { ...row };
        return {
          ...row,
          lines: lines
            .filter((line) => line.draftId === row.id)
            .sort((a, b) => a.sortOrder - b.sortOrder),
          chatTurns: [],
        };
      },
      async findMany({ where }) {
        return drafts
          .filter((draft) => {
            if (draft.storageUnitId !== where.storageUnitId || draft.status !== where.status) return false;
            if (where.recipientUnitId && draft.recipientUnitId !== where.recipientUnitId) return false;
            if (where.recipientUserId && draft.recipientUserId !== where.recipientUserId) return false;
            return true;
          })
          .map((draft) => ({
            ...draft,
            lines: lines.filter((line) => line.draftId === draft.id),
          }));
      },
      async updateMany({ where, data }) {
        const row = drafts.find(
          (draft) =>
            draft.id === where.id &&
            draft.version === where.version &&
            draft.status === where.status &&
            draft.storageUnitId === where.storageUnitId,
        );
        if (!row) return { count: 0 };
        if (data.version?.increment) row.version += data.version.increment;
        if (data.status) row.status = data.status;
        return { count: 1 };
      },
      async update({ where, data }) {
        const row = drafts.find((draft) => draft.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    lttpAiDraftLine: {
      async findFirst({ where }) {
        return lines.find((line) => line.id === where.id && line.draftId === where.draftId) || null;
      },
      async update({ where, data }) {
        const row = lines.find((line) => line.id === where.id);
        Object.assign(row, data);
        return { ...row };
      },
    },
    lttpAiDraftLineEvent: {
      async createMany({ data }) {
        events.push(...data);
      },
      async create({ data }) {
        events.push(data);
        return data;
      },
    },
  };
}

test("initial line status follows needsConfirm", () => {
  assert.equal(initialLineStatus({ needsConfirm: true }), "needs_confirm");
  assert.equal(initialLineStatus({ needsConfirm: false }), "sure");
});

test("create draft stores lines and an ai event per line", async () => {
  const db = memoryPrisma();
  const draft = await createIssueSlipAiDraft(db, {
    storageUnitId: 9,
    recipientUnitId: 4,
    recipientUserId: 7,
    rawText: "2 gao",
    actorUserId: 3,
    lines: [
      { commodityId: 10, commodityName: "Gạo tẻ", quantity: 2, measureUnit: "kg", source: "score", confidence: 0.8, needsConfirm: false, rawName: "gao", choices: [] },
      { rawName: "sua", needsConfirm: true, source: "none", choices: [{ commodityId: 11, name: "Sữa" }] },
    ],
  });
  assert.equal(draft.version, 1);
  assert.equal(draft.lines[0].status, "sure");
  assert.equal(draft.lines[1].status, "needs_confirm");
  assert.equal(db.events.length, 2);
  assert.equal(db.events[0].source, "ai");
});

test("choice edit marks the line edited and rejects a stale version", async () => {
  const db = memoryPrisma();
  const draft = await createIssueSlipAiDraft(db, {
    storageUnitId: 9,
    recipientUnitId: 4,
    recipientUserId: 7,
    rawText: "sua",
    actorUserId: 3,
    lines: [{ rawName: "sua", needsConfirm: true, source: "none", choices: [] }],
  });
  const lineId = draft.lines[0].id;
  const updated = await updateIssueSlipAiDraftLine(db, {
    id: draft.id,
    lineId,
    storageUnitId: 9,
    version: 1,
    source: "choice",
    commodityId: 10,
    commodityName: "Gạo tẻ",
    quantity: 2,
    measureUnit: "kg",
    actorUserId: 3,
  });
  assert.equal(updated.version, 2);
  assert.equal(updated.lines[0].status, "edited");
  assert.equal(updated.lines[0].commodityId, 10);
  assert.equal(db.events.at(-1).source, "choice");

  await assert.rejects(
    () =>
      updateIssueSlipAiDraftLine(db, {
        id: draft.id,
        lineId,
        storageUnitId: 9,
        version: 1,
        source: "manual",
        quantity: 3,
        actorUserId: 3,
      }),
    (error) => error instanceof AppError && error.statusCode === 409,
  );
});

test("unknown sku is rejected and discard hides the draft from the open list", async () => {
  const db = memoryPrisma();
  const draft = await createIssueSlipAiDraft(db, {
    storageUnitId: 9,
    recipientUnitId: 4,
    recipientUserId: 7,
    rawText: "x",
    actorUserId: 3,
    lines: [{ rawName: "x", needsConfirm: true, source: "none", choices: [] }],
  });
  await assert.rejects(
    () =>
      updateIssueSlipAiDraftLine(db, {
        id: draft.id,
        lineId: draft.lines[0].id,
        storageUnitId: 9,
        version: 1,
        source: "manual",
        commodityId: 99,
        actorUserId: 3,
      }),
    (error) => error instanceof AppError && error.statusCode === 400,
  );
  await discardIssueSlipAiDraft(db, { id: draft.id, storageUnitId: 9, version: 2 });
  const open = await listEditingIssueSlipAiDrafts(db, { storageUnitId: 9, recipientUnitId: 4 });
  assert.equal(open.length, 0);
});
