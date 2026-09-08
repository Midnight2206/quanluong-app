import assert from "node:assert/strict";
import { mock, test } from "node:test";

process.env.DATABASE_URL ||= "mysql://test:test@localhost/test";
process.env.JWT_ACCESS_SECRET ||= "test-jwt-secret";
process.env.SESSION_SECRET ||= "test-session-secret";

const prismaIssueSlipFindMany = mock.fn(async () => []);
const prismaUnitFindMany = mock.fn(async () => []);

mock.module("../../infra/database/prisma/prisma.client.js", {
  exports: {
    prisma: {
      lttpIssueSlip: { findMany: prismaIssueSlipFindMany },
      unit: { findMany: prismaUnitFindMany },
    },
  },
});

const { resolveMonthlySheetContexts } = await import("./chung-tu-data-resolver.service.js");
import {
  CHUNG_TU_AGGREGATION_MODES,
  CHUNG_TU_CATEGORY_KEYS,
} from "./chung-tu-category.constants.js";

function line(commodityId, qty, amount) {
  return {
    commodity: { id: commodityId, name: `C${commodityId}`, measureUnit: "Kg" },
    quantity: qty,
    unitPrice: amount / qty,
    amount,
  };
}

function slip(recipientUnitId, slipNo, lines) {
  return { id: slipNo, slipNo, recipientUnitId, lines };
}

function dayFromFindManyArgs(args) {
  const gte = args?.where?.issueDate?.gte;
  return gte instanceof Date ? gte.toISOString().slice(0, 10) : "";
}

test.beforeEach(() => {
  prismaIssueSlipFindMany.mock.resetCalls();
  prismaUnitFindMany.mock.resetCalls();
  prismaUnitFindMany.mock.mockImplementation(async ({ where }) =>
    (where?.id?.in ?? []).map((id) => ({ id, name: `Unit ${id}` })),
  );
});

test("PXK by-day: two units same day produce two sheet contexts", async () => {
  prismaIssueSlipFindMany.mock.mockImplementation(async (args) => {
    if (dayFromFindManyArgs(args) === "2026-06-05") {
      return [
        slip(10, 1, [line(1, 2, 2000)]),
        slip(11, 2, [line(2, 3, 3000)]),
      ];
    }
    return [];
  });

  const monthly = await resolveMonthlySheetContexts({
    periodMonth: "2026-06",
    unitIds: [10, 11],
    aggregationMode: CHUNG_TU_AGGREGATION_MODES.BY_DAY,
    categoryKey: CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO,
    resolveSettingsForSlips: () => ({}),
  });

  const dayContexts = (monthly.sheetContexts ?? []).filter((ctx) => ctx.periodDate === "2026-06-05");
  assert.equal(dayContexts.length, 2);
  assert.deepEqual(
    dayContexts.map((ctx) => ctx.recipientUnitId).sort((a, b) => a - b),
    [10, 11],
  );
});

test("PXK by-day: one unit two slips same day merge into one context", async () => {
  prismaIssueSlipFindMany.mock.mockImplementation(async (args) => {
    if (dayFromFindManyArgs(args) === "2026-06-05") {
      return [
        slip(10, 1, [line(1, 2, 2000)]),
        slip(10, 2, [line(1, 3, 3000)]),
      ];
    }
    return [];
  });

  const monthly = await resolveMonthlySheetContexts({
    periodMonth: "2026-06",
    unitIds: [10],
    aggregationMode: CHUNG_TU_AGGREGATION_MODES.BY_DAY,
    categoryKey: CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO,
    resolveSettingsForSlips: () => ({}),
  });

  const dayContexts = (monthly.sheetContexts ?? []).filter((ctx) => ctx.periodDate === "2026-06-05");
  assert.equal(dayContexts.length, 1);
  assert.equal(dayContexts[0].recipientUnitId, 10);
  assert.equal(dayContexts[0].slipCount, 2);
  assert.equal(dayContexts[0].detailRows.length, 1);
  assert.equal(dayContexts[0].detailRows[0].soLuong, "5");
});

test("BKMH by-day: two units same day stay one sheet context", async () => {
  prismaIssueSlipFindMany.mock.mockImplementation(async (args) => {
    if (dayFromFindManyArgs(args) === "2026-06-05") {
      return [
        slip(10, 1, [line(1, 2, 2000)]),
        slip(11, 2, [line(2, 3, 3000)]),
      ];
    }
    return [];
  });

  const monthly = await resolveMonthlySheetContexts({
    periodMonth: "2026-06",
    unitIds: [10, 11],
    aggregationMode: CHUNG_TU_AGGREGATION_MODES.BY_DAY,
    categoryKey: CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG,
    resolveSettingsForSlips: () => ({}),
  });

  const dayContexts = (monthly.sheetContexts ?? []).filter((ctx) => ctx.periodDate === "2026-06-05");
  assert.equal(dayContexts.length, 1);
  assert.equal(dayContexts[0].recipientUnitId, undefined);
  assert.equal(dayContexts[0].slipCount, 2);
});

test("PXK by-day skips empty unit-day pairs", async () => {
  prismaIssueSlipFindMany.mock.mockImplementation(async () => []);

  const monthly = await resolveMonthlySheetContexts({
    periodMonth: "2026-06",
    unitIds: [10],
    aggregationMode: CHUNG_TU_AGGREGATION_MODES.BY_DAY,
    categoryKey: CHUNG_TU_CATEGORY_KEYS.PHIEU_XUAT_KHO,
    resolveSettingsForSlips: () => ({}),
  });

  assert.equal(monthly.sheetContexts.length, 0);
});
