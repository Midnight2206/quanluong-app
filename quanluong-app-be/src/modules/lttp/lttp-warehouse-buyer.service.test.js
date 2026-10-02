import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  resolveWarehouseBuyerForIssueDate,
  rewriteAllWarehouseSlipBuyers,
  setWarehouseBuyerTerm,
} from "./lttp-warehouse-buyer.service.js";

const day = (ymd) => new Date(Date.UTC(...ymd.split("-").map((n, i) => (i === 1 ? Number(n) - 1 : Number(n)))));

function buyerDb({ user = null, slipsUpdated = 0 } = {}) {
  const calls = [];
  const db = {
    user: {
      findFirst: async (args) => {
        calls.push(["user.findFirst", args]);
        return user;
      },
    },
    lttpWarehouseBuyerTerm: {
      findFirst: async (args) => {
        calls.push(["term.findFirst", args]);
        return null;
      },
      upsert: async (args) => {
        calls.push(["term.upsert", args]);
        return args.create;
      },
    },
    lttpIssueSlip: {
      updateMany: async (args) => {
        calls.push(["slip.updateMany", args]);
        return { count: slipsUpdated };
      },
    },
    lttpUnitIssueFormDefaults: {
      upsert: async (args) => {
        calls.push(["defaults.upsert", args]);
        return args.create;
      },
    },
  };
  return { db, calls };
}

const sameUnitUser = {
  id: 9,
  username: "mua",
  profile: { fullName: "Nguyễn Mua" },
};

test("resolveBuyer picks the latest term on or before the issue date", async () => {
  const { db, calls } = buyerDb();
  db.lttpWarehouseBuyerTerm.findFirst = async (args) => {
    calls.push(["term.findFirst", args]);
    return {
      buyerUserId: 9,
      effectiveDate: day("2026-06-01"),
      buyerUser: sameUnitUser,
    };
  };
  const result = await resolveWarehouseBuyerForIssueDate(4, "2026-06-15", db);
  assert.equal(result.buyerUserId, 9);
  assert.equal(result.buyerDisplayName, "Nguyễn Mua");
  assert.deepEqual(calls[0][1].where, {
    unitId: 4,
    effectiveDate: { lte: day("2026-06-15") },
  });
  assert.deepEqual(calls[0][1].orderBy, { effectiveDate: "desc" });
});

test("resolveBuyer leaves the buyer empty when no term covers the date", async () => {
  const { db } = buyerDb();
  const result = await resolveWarehouseBuyerForIssueDate(4, day("2026-01-01"), db);
  assert.deepEqual(result, { buyerUserId: null, buyerDisplayName: null, effectiveDate: null });
});

test("setWarehouseBuyer updates only slips on or after the effective date", async () => {
  const { db, calls } = buyerDb({ user: sameUnitUser, slipsUpdated: 0 });
  const result = await setWarehouseBuyerTerm(
    { storageUnitId: 4, userId: 9, effectiveDate: "2026-06-01", createdById: 1 },
    db,
  );
  const slipCall = calls.find((c) => c[0] === "slip.updateMany");
  assert.deepEqual(slipCall[1].where, {
    unitId: 4,
    issueDate: { gte: day("2026-06-01") },
  });
  assert.equal(slipCall[1].data.buyerUserId, 9);
  assert.equal(result.slipsUpdated, 0);
  assert.equal(result.effectiveDate, "2026-06-01");
});

test("setWarehouseBuyer rejects a user from another unit", async () => {
  const { db, calls } = buyerDb({ user: null });
  await assert.rejects(
    () =>
      setWarehouseBuyerTerm(
        { storageUnitId: 4, userId: 8, effectiveDate: "2026-06-01", createdById: 1 },
        db,
      ),
    /chính kho này/,
  );
  assert.equal(calls.some((c) => c[0] === "slip.updateMany"), false);
});

test("rewriteAll assigns every slip of the warehouse and ignores the date", async () => {
  const { db, calls } = buyerDb({ user: sameUnitUser, slipsUpdated: 0 });
  const result = await rewriteAllWarehouseSlipBuyers({ storageUnitId: 4, userId: 9 }, db);
  const slipCall = calls.find((c) => c[0] === "slip.updateMany");
  assert.deepEqual(slipCall[1].where, { unitId: 4 });
  assert.equal(slipCall[1].data.buyerDisplayName, "Nguyễn Mua");
  assert.equal(result.slipsUpdated, 0);
  assert.equal(calls.some((c) => c[0] === "term.upsert"), false);
});

test("issue slip save resolves the buyer from the warehouse term, not the form", () => {
  const src = readFileSync(new URL("./lttp.service.js", import.meta.url), "utf8");
  const createFn = src.slice(src.indexOf("async function createIssueSlip"), src.indexOf("async function updateIssueSlip"));
  const updateFn = src.slice(src.indexOf("async function updateIssueSlip"), src.indexOf("async function deleteIssueSlip"));
  assert.match(createFn, /resolveBuyerFields\(storageUnitId, issueD\)/);
  assert.doesNotMatch(createFn, /resolveBuyerFields\(payload/);
  assert.match(updateFn, /resolvedBuyer\.buyerUserId \?\? existing\.buyerUserId/);
  const listFn = src.slice(src.indexOf("async function listBuyerUsers"), src.indexOf("async function listBuyerDefaultsInScope"));
  assert.match(listFn, /unitId: khoId/);
  assert.doesNotMatch(listFn, /resolveBuyerPickUnitIds/);
});
