import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ||= "mysql://test:test@localhost/test";
process.env.JWT_ACCESS_SECRET ||= "test-jwt-secret";
process.env.SESSION_SECRET ||= "test-session-secret";

const { allocateDocNumber } = await import("./chung-tu-doc-number.service.js");

function createFakeDb() {
  const counters = new Map();
  const assignments = new Map();
  let counterId = 1;
  let assignmentId = 1;

  const counterKey = (unitId, categoryKey, quyenSo) => `${unitId}|${categoryKey}|${quyenSo}`;
  const assignmentKey = (unitId, categoryKey, quyenSo, sheetKey) =>
    `${unitId}|${categoryKey}|${quyenSo}|${sheetKey}`;

  const tx = {
    chungTuDocNumberAssignment: {
      findUnique: async ({ where }) => {
        const w = where.unitId_categoryKey_quyenSo_sheetKey;
        return assignments.get(assignmentKey(w.unitId, w.categoryKey, w.quyenSo, w.sheetKey)) ?? null;
      },
      create: async ({ data }) => {
        const key = assignmentKey(data.unitId, data.categoryKey, data.quyenSo, data.sheetKey);
        if (assignments.has(key)) {
          const err = new Error("Unique constraint failed");
          err.code = "P2002";
          throw err;
        }
        const record = { id: assignmentId++, ...data, createdAt: new Date() };
        assignments.set(key, record);
        return record;
      },
    },
    chungTuDocNumberCounter: {
      upsert: async ({ where, create }) => {
        const w = where.unitId_categoryKey_quyenSo;
        const key = counterKey(w.unitId, w.categoryKey, w.quyenSo);
        if (!counters.has(key)) {
          const record = { id: counterId++, ...create };
          counters.set(key, record);
          return { ...record };
        }
        return { ...counters.get(key) };
      },
      update: async ({ where, data }) => {
        const counter = [...counters.values()].find((c) => c.id === where.id);
        counter.nextSeq = data.nextSeq;
        return { ...counter };
      },
    },
  };

  return {
    $transaction: async (fn) => fn(tx),
  };
}

test("allocateDocNumber returns same soChungTu for same sheetKey", async () => {
  const fakeDb = createFakeDb();
  const first = await allocateDocNumber(
    {
      unitId: 1,
      categoryKey: "phieu-xuat-kho",
      quyenSo: "0926",
      sheetKey: "unit:5",
    },
    fakeDb,
  );
  const second = await allocateDocNumber(
    {
      unitId: 1,
      categoryKey: "phieu-xuat-kho",
      quyenSo: "0926",
      sheetKey: "unit:5",
    },
    fakeDb,
  );
  assert.equal(first.soChungTu, "0001");
  assert.deepEqual(first, second);
});

test("allocateDocNumber increments for new sheetKey", async () => {
  const fakeDb = createFakeDb();
  await allocateDocNumber(
    { unitId: 1, categoryKey: "phieu-xuat-kho", quyenSo: "0926", sheetKey: "unit:5" },
    fakeDb,
  );
  const next = await allocateDocNumber(
    {
      unitId: 1,
      categoryKey: "phieu-xuat-kho",
      quyenSo: "0926",
      sheetKey: "unit:6",
    },
    fakeDb,
  );
  assert.equal(next.soChungTu, "0002");
});

test("counters are independent per categoryKey", async () => {
  const fakeDb = createFakeDb();
  await allocateDocNumber(
    { unitId: 1, categoryKey: "phieu-xuat-kho", quyenSo: "0926", sheetKey: "unit:5" },
    fakeDb,
  );
  const bkmh = await allocateDocNumber(
    {
      unitId: 1,
      categoryKey: "bang-ke-mua-hang",
      quyenSo: "0926",
      sheetKey: "unit:5",
    },
    fakeDb,
  );
  assert.equal(bkmh.soChungTu, "0001");
});
