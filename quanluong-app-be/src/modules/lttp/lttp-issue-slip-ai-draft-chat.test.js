import assert from "node:assert/strict";
import test from "node:test";
import {
  applyProposedDraftPatch,
  proposeIssueSlipAiDraftChat,
  undoLastDraftChatApply,
} from "./lttp-issue-slip-ai-draft-chat.js";

function memoryPrisma() {
  const drafts = [
    {
      id: 1,
      storageUnitId: 9,
      recipientUnitId: 4,
      status: "editing",
      version: 1,
      rawText: "2 lo gao",
    },
  ];
  const lines = [
    {
      id: 5,
      draftId: 1,
      sortOrder: 0,
      status: "sure",
      commodityId: 10,
      commodityName: "Gạo tẻ",
      code: "GAO",
      quantity: 2,
      measureUnit: "chai",
      lttpSupplierId: 3,
      unitPrice: 10000,
      choices: [{ commodityId: 11, name: "Gạo nếp" }],
    },
  ];
  const turns = [];
  let nextTurn = 1;
  return {
    lines,
    turns,
    lttpCommodity: {
      async findMany({ where }) {
        return (where.id?.in || [])
          .filter((id) => id === 10 || id === 11)
          .map((id) => ({
            id,
            name: id === 10 ? "Gạo tẻ" : "Gạo nếp",
            code: id === 10 ? "GAO" : "NEP",
            measureUnit: "chai",
            lttpCommodityDefaultSupplier: { lttpSupplierId: id === 11 ? 8 : 3 },
          }));
      },
    },
    lttpAiUomRule: {
      async findMany() {
        return [{ commodityId: 10, fromUom: "lo", factor: 12, confirmed: true }];
      },
    },
    lttpAiOrderDraft: {
      async findUnique({ where, include }) {
        const row = drafts.find((draft) => draft.id === where.id);
        if (!row) return null;
        if (!include) return { ...row };
        return {
          ...row,
          lines: lines.filter((line) => line.draftId === row.id),
          chatTurns: turns.filter((turn) => turn.draftId === row.id),
        };
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
        row.version += data.version.increment;
        return { count: 1 };
      },
    },
    lttpAiDraftLine: {
      async update({ where, data }) {
        const row = lines.find((line) => line.id === where.id);
        Object.assign(row, data);
        return { ...row };
      },
    },
    lttpAiDraftLineEvent: {
      async create({ data }) {
        return data;
      },
    },
    lttpAiDraftChatTurn: {
      async create({ data }) {
        const row = { ...data, id: nextTurn };
        nextTurn += 1;
        turns.push(row);
        return row;
      },
      async update({ where, data }) {
        const row = turns.find((turn) => turn.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
  };
}

test("propose keeps the draft line until apply, and undo restores it", async () => {
  const db = memoryPrisma();
  const proposed = await proposeIssueSlipAiDraftChat(
    db,
    { id: 1, storageUnitId: 9, message: "2 lo", lineIds: [5], actorUserId: 1 },
    {
      complete: async (prompt) => {
        assert.match(prompt.user, /5 \|/);
        assert.doesNotMatch(prompt.user, /chat cu/);
        return { explanation: "Đổi ra lô", patch: [{ line_id: 5, qty: 2, unit: "lo" }] };
      },
    },
  );
  assert.equal(db.lines[0].quantity, 2);
  assert.equal(proposed.diff[0].after.quantity, 24);
  const applied = await applyProposedDraftPatch(db, {
    id: 1,
    storageUnitId: 9,
    version: 1,
    turnId: proposed.turnId,
    acceptRule: false,
    actorUserId: 1,
  });
  assert.equal(Number(applied.lines[0].quantity), 24);
  assert.equal(applied.version, 2);
  const undone = await undoLastDraftChatApply(db, {
    id: 1,
    storageUnitId: 9,
    version: 2,
    actorUserId: 1,
  });
  assert.equal(Number(undone.lines[0].quantity), 2);
  assert.equal(undone.lines[0].status, "sure");
  assert.equal(undone.version, 3);
});
