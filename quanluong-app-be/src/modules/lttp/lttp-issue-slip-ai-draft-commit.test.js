import assert from "node:assert/strict";
import test from "node:test";
import { commitIssueSlipAiDraft, lineLearnWeight } from "./lttp-issue-slip-ai-draft-commit.js";
import { learnConfirmedOrder } from "./lttp-issue-slip-ai-learn.js";

function learnPrisma() {
  const aliases = [];
  const habits = [];
  const logs = [];
  return {
    logs,
    aliases,
    habits,
    lttpAiFillLog: {
      async create({ data }) {
        logs.push(data);
        return data;
      },
    },
    lttpAiAliasStat: {
      async upsert({ where, create, update }) {
        const key = where.recipientUnitId_rawNorm_commodityId;
        let row = aliases.find(
          (item) =>
            item.recipientUnitId === key.recipientUnitId &&
            item.rawNorm === key.rawNorm &&
            item.commodityId === key.commodityId,
        );
        if (!row) {
          row = { ...create };
          aliases.push(row);
        } else if (update.hitCount?.increment) {
          row.hitCount += update.hitCount.increment;
        }
        return row;
      },
    },
    lttpAiCommodityHabit: {
      async findUnique() {
        return null;
      },
      async upsert({ create }) {
        habits.push(create);
        return create;
      },
    },
  };
}

test("line weights: edited is strong, untouched is quiet unless the whole slip is confirmed", () => {
  assert.deepEqual(lineLearnWeight({ status: "edited" }, false), {
    aliasWeight: 3,
    verdict: "ai_wrong",
  });
  assert.deepEqual(lineLearnWeight({ status: "sure" }, false), {
    aliasWeight: 0,
    verdict: "untouched",
  });
  assert.deepEqual(lineLearnWeight({ status: "sure" }, true), {
    aliasWeight: 1,
    verdict: "ai_correct",
  });
  assert.equal(lineLearnWeight({ status: "needs_confirm" }, true), null);
});

test("learn increments alias by the line weight and still records quantity", async () => {
  const db = learnPrisma();
  await learnConfirmedOrder({
    prisma: db,
    recipientUnitId: 4,
    issueSlipId: 9,
    aiLines: [{ rawName: "gao" }, { rawName: "sua" }],
    confirmedLines: [
      { commodityId: 10, quantity: 2, measureUnit: "kg", aliasWeight: 3, verdict: "ai_wrong" },
      { commodityId: 11, quantity: 1, measureUnit: "chai", aliasWeight: 0, verdict: "untouched" },
    ],
  });
  assert.equal(db.aliases.length, 1);
  assert.equal(db.aliases[0].hitCount, 3);
  assert.equal(db.aliases[0].commodityId, 10);
  assert.equal(db.habits.length, 2);
  assert.equal(db.logs[0].confirmedJson[0].verdict, "ai_wrong");
});

function commitPrisma(status = "sure") {
  const draft = {
    id: 1,
    storageUnitId: 9,
    recipientUnitId: 4,
    recipientUserId: 7,
    orderMessageId: null,
    status: "editing",
    version: 1,
    rawText: "gao",
  };
  const lines = [
    {
      id: 5,
      draftId: 1,
      sortOrder: 0,
      status,
      commodityId: 10,
      quantity: 2,
      measureUnit: "kg",
      rawName: "gao",
      writtenQty: "2",
      writtenUom: "kg",
    },
  ];
  const events = [
    {
      draftLineId: 5,
      source: "ai",
      createdAt: 1,
      afterJson: { commodityId: 11, quantity: 2, measureUnit: "kg", commodityName: "Gạo nếp" },
    },
    { draftLineId: 5, source: "choice", createdAt: 2, afterJson: { commodityId: 10 } },
  ];
  const turns = [
    {
      id: 3,
      draftId: 1,
      role: "assistant",
      applied: true,
      proposedPatch: {
        acceptRule: true,
        ruleSuggestion: { type: "uom", fromUom: "lo", factor: 12, commodityId: 10 },
      },
    },
  ];
  const rules = [];
  const db = {
    rules,
    ...learnPrisma(),
    $transaction: (fn) => fn(db),
    lttpIssueSlip: {
      async findUnique() {
        return { id: 20, unitId: 9 };
      },
    },
    lttpCommodity: {
      async findFirst() {
        return { id: 10, unitId: 9 };
      },
    },
    lttpAiUomRule: {
      async findFirst() {
        return null;
      },
      async create({ data }) {
        rules.push(data);
        return data;
      },
    },
    lttpAiDraftLineEvent: {
      async findMany() {
        return events;
      },
    },
    lttpAiOrderDraft: {
      async findUnique({ where, include }) {
        if (draft.id !== where.id) return null;
        if (!include) return { ...draft };
        return {
          ...draft,
          lines: lines.filter((line) => line.draftId === draft.id),
          chatTurns: turns,
        };
      },
      async updateMany({ where, data }) {
        if (draft.id !== where.id || draft.version !== where.version || draft.status !== "editing") {
          return { count: 0 };
        }
        draft.version += data.version.increment;
        return { count: 1 };
      },
      async update({ data }) {
        Object.assign(draft, data);
        return draft;
      },
    },
  };
  return { db, draft };
}

test("commit refuses a draft that still needs confirmation", async () => {
  const { db } = commitPrisma("needs_confirm");
  await assert.rejects(
    () =>
      commitIssueSlipAiDraft(db, {
        id: 1,
        storageUnitId: 9,
        version: 1,
        issueSlipId: 20,
        confirmAll: false,
      }),
    (error) => error.statusCode === 400,
  );
});

test("commit learns the edited line, stores the agreed unit rule, and locks the draft", async () => {
  const { db, draft } = commitPrisma("edited");
  const result = await commitIssueSlipAiDraft(db, {
    id: 1,
    storageUnitId: 9,
    version: 1,
    issueSlipId: 20,
    confirmAll: false,
  });
  assert.equal(draft.status, "committed");
  assert.equal(draft.issueSlipId, 20);
  assert.equal(result.draft.version, 2);
  assert.equal(db.aliases[0].hitCount, 3);
  assert.equal(db.logs[0].confirmedJson[0].editSource, "choice");
  assert.equal(db.logs[0].confirmedJson[0].verdict, "ai_wrong");
  assert.equal(db.logs[0].aiJson[0].commodityId, 11);
  assert.equal(db.rules[0].fromUom, "lo");
  assert.equal(db.rules[0].confirmed, true);
});
