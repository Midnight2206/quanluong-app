import assert from "node:assert/strict";
import test from "node:test";
import { createToolGrant, clearToolGrants } from "./grants.js";
import { proposeIssueSlipDraft, proposeLedgerDraft, readLedgerDay } from "./tools.service.js";

test("ledger propose is a draft and ledger read uses the grant scope", async () => {
  clearToolGrants();
  const grantId = createToolGrant({
    feature: "kitchen-ledger-movement",
    unitId: 7,
    scope: { mode: "all" },
    effectiveUnitIds: null,
    dataScope: { storageUnitId: 3, logicalUnitId: 7 },
  });
  let query;
  const view = await readLedgerDay({ grantId, date: "2026-10-21" }, {
    getLedger: async (input) => {
      query = input;
      return { date: input.date, headcountSaved: true, lines: [{ name: "Gạo", qty: 2, kind: "rice" }], movements: [] };
    },
  });
  assert.equal(query.unitId, 7);
  assert.equal(view.lines[0].name, "Gạo");
  assert.equal(view.committed, undefined);

  const draft = proposeLedgerDraft({
    grantId,
    date: "2026-10-21",
    records: [{ type: "note", text: "khong co hang", confidence: 0.9, source: "mua" }],
  });
  assert.equal(draft.committed, false);
  assert.equal(draft.draft, true);
  assert.equal(draft.notes[0].text, "khong co hang");
  assert.equal(draft.lines.length, 0);
});

test("a menu grant cannot read the ledger", async () => {
  clearToolGrants();
  const grantId = createToolGrant({
    feature: "kitchen-menu-suggest",
    unitId: 7,
    scope: { mode: "all" },
    dataScope: { storageUnitId: 3 },
  });
  await assert.rejects(
    () => readLedgerDay({ grantId, date: "2026-10-21" }, { getLedger: async () => ({}) }),
    (err) => err.statusCode === 403,
  );
});

test("issue-slip propose does not commit", () => {
  clearToolGrants();
  const grantId = createToolGrant({ feature: "lttp-issue-slip", unitId: 3 });
  const draft = proposeIssueSlipDraft({
    grantId,
    lines: [{ name: "Gạo", qty: 2, uom: "kg" }],
  });
  assert.equal(draft.committed, false);
  assert.equal(draft.lines[0].name, "Gạo");
  assert.equal(draft.lines[0].qty, 2);
});
