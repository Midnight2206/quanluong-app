# Task 7 Report — PNK export UI date range + buyer-aware aggregation

**Status:** completed

## Summary

Updated the PNK export workspace to use `dateFrom`/`dateTo` instead of month-only inputs, show only `Theo ngày` and `Nhiều ngày` aggregation options, and build a PNK payload without `unitIds` or `periodMonth`. The export workspace also normalizes outgoing signature blocks so a locked `NGƯỜI GIAO` slot is always first before the batch export request is sent.

## Files

- `packages/shared/src/pages/chungTuQuyetToan/ChungTuExportWorkspace.jsx`
- `packages/shared/src/pages/chungTuQuyetToan/ChungTuBkmhMonthlySummary.test.js`

## Verification

```bash
node --test packages/shared/src/pages/chungTuQuyetToan/ChungTuBkmhMonthlySummary.test.js
```

The targeted frontend suite passed locally.

## Notes

- Validation now checks `dateFrom`, `dateTo`, and `dateFrom <= dateTo` for PNK before preview/export.
- The summary card and wizard stepper now describe PNK by date range rather than by month.
- Non-PNK monthly flows keep the existing month + `unitIds` behavior.
