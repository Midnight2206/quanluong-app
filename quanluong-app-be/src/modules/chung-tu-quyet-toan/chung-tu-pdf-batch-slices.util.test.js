import assert from "node:assert/strict";
import test from "node:test";

import { pickExportSlices } from "./chung-tu-pdf-batch-slices.util.js";

test("pickExportSlices by-day uses unit and date when recipientUnitId present", () => {
  const slices = pickExportSlices({
    aggregationMode: "by-day",
    context: {
      sheetContexts: [
        {
          periodDate: "2026-06-05",
          recipientUnitId: 10,
          recipientUnitName: "Tiểu đoàn 1",
          detailRows: [{ tenHang: "A" }],
        },
        {
          periodDate: "2026-06-05",
          recipientUnitId: 11,
          recipientUnitName: "Tiểu đoàn 2",
          detailRows: [{ tenHang: "B" }],
        },
      ],
    },
  });

  assert.deepEqual(
    slices.map((item) => ({ fileName: item.fileName, sortKey: item.sortKey })),
    [
      { fileName: "Tiểu đoàn 1-2026-06-05.pdf", sortKey: "Tiểu đoàn 1-2026-06-05" },
      { fileName: "Tiểu đoàn 2-2026-06-05.pdf", sortKey: "Tiểu đoàn 2-2026-06-05" },
    ],
  );
});

test("pickExportSlices by-day keeps date-only naming without recipientUnitId", () => {
  const slices = pickExportSlices({
    aggregationMode: "by-day",
    context: {
      sheetContexts: [{ periodDate: "2026-06-01", detailRows: [{ tenHang: "A" }] }],
    },
  });

  assert.deepEqual(slices[0], {
    context: { periodDate: "2026-06-01", detailRows: [{ tenHang: "A" }] },
    fileName: "2026-06-01.pdf",
    sortKey: "2026-06-01",
  });
});
