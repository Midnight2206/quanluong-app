import assert from "node:assert/strict";
import { mock, test } from "node:test";

process.env.DATABASE_URL ||= "mysql://test:test@localhost/test";
process.env.JWT_ACCESS_SECRET ||= "test-jwt-secret";
process.env.SESSION_SECRET ||= "test-session-secret";

const resolveChungTuContext = mock.fn(async () => ({
  context: { periodDate: "2026-06-01", detailRows: [{ stt: 1 }] },
  sourceDataHash: "preview-hash-123",
}));

mock.module("../../infra/database/prisma/prisma.client.js", {
  exports: {
    prisma: {},
  },
});

mock.module("./chung-tu-category.constants.js", {
  exports: {
    CHUNG_TU_AGGREGATION_MODES: {
      BY_DAY: "by-day",
      BY_UNIT: "by-unit",
      FULL: "full",
    },
    CHUNG_TU_CATEGORY_KEYS: {
      PHIEU_NHAP_KHO: "phieu-nhap-kho",
      BANG_KE_MUA_HANG: "bang-ke-mua-hang",
    },
    CHUNG_TU_DOCUMENT_STATUS: {
      LOCKED: "locked",
      STALE: "stale",
      SYNCED: "synced",
    },
    assertKnownCategoryKey: mock.fn((key) => ({ key, mode: "by-date" })),
    getAggregationModeLabel: mock.fn((mode) => mode),
    normalizeAggregationMode: mock.fn((mode) => mode),
  },
});

mock.module("./chung-tu-document-key.js", {
  exports: {
    buildChungTuDocumentKey: mock.fn(() => "doc-key"),
  },
});

mock.module("./chung-tu-bkmh-snapshot.service.js", {
  exports: {
    persistBkmhSnapshots: mock.fn(async () => ({})),
    listBkmhSnapshotsForDocument: mock.fn(async () => []),
  },
});

mock.module("./chung-tu-drive-folders.service.js", {
  exports: {
    assertTemplateInCategoryFolder: mock.fn(async () => ({})),
    copyTemplateToUnitFolder: mock.fn(async () => ({})),
  },
});

mock.module("./chung-tu-data-resolver.service.js", {
  exports: {
    resolveChungTuContext,
  },
});

mock.module("./chung-tu-sheet-sync.service.js", {
  exports: {
    syncSpreadsheetFromContext: mock.fn(async () => ({})),
  },
});

mock.module("./chung-tu-monthly-sheets.js", {
  exports: {
    normalizeMonthUnitIds: mock.fn((value) =>
      Array.isArray(value) ? value.map((item) => Number(item)).filter(Number.isFinite) : [],
    ),
    normalizePeriodMonth: mock.fn((value) => value),
    lastDayOfMonth: mock.fn(() => "2026-06-30"),
  },
});

mock.module("./chung-tu-drive-file-state.js", {
  exports: {
    getUserDriveFileAvailability: mock.fn(async () => null),
    trashUserDriveFileIfExists: mock.fn(async () => ({})),
  },
});

mock.module("./chung-tu-template-tree.service.js", {
  exports: {
    resolveTemplateSelectionMeta: mock.fn(async () => ({})),
  },
});

const { previewChungTuContext } = await import("./chung-tu-document.service.js");

test.beforeEach(() => {
  resolveChungTuContext.mock.resetCalls();
});

test("previewChungTuContext forwards PNK date range to resolver", async () => {
  const result = await previewChungTuContext({
    categoryKey: "phieu-nhap-kho",
    unitId: 9,
    dateFrom: "2026-06-01",
    dateTo: "2026-06-03",
    aggregationMode: "full",
    settings: { ghiChu: "preview" },
    exportingUserProfile: { donVi: "Kho A" },
    effectiveUnitIds: [9, 10],
  });

  assert.deepEqual(resolveChungTuContext.mock.calls[0].arguments[0], {
    categoryKey: "phieu-nhap-kho",
    unitId: 9,
    periodDate: undefined,
    periodMonth: undefined,
    dateFrom: "2026-06-01",
    dateTo: "2026-06-03",
    issueSlipId: undefined,
    unitIds: undefined,
    aggregationMode: "full",
    settings: { ghiChu: "preview" },
    exportingUserProfile: { donVi: "Kho A" },
  });
  assert.equal(result.sourceDataHash, "preview-hash-123");
});
