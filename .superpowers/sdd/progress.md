# SDD Progress — template-field-labels-and-catalog-lookup (2026-09-05)

Plan: docs/superpowers/plans/2026-09-05-template-field-labels-and-catalog-lookup.md
Spec: docs/superpowers/specs/2026-09-05-template-field-labels-and-catalog-lookup-design.md
## Tasks

- Task 1: complete (commit ef90336) — fieldLabelsJson schema + migration

# SDD Progress — bkmh-slice-lines-pnk-sources (2026-09-04)

Plan: docs/superpowers/plans/2026-09-04-bkmh-slice-lines-pnk-sources.md
Spec: docs/superpowers/specs/2026-09-04-bkmh-slice-lines-pnk-sources-design.md

## Tasks

- Task 1: complete (commit ea73eb1) — Migration detailRowsJson
- Task 2: complete (commit 82f769e) — Snapshot util
- Task 3: complete (commit 0f6000c) — Persist + API map
- Task 4: complete (code verified; re-export BKMH needed for old months)
- Task 5: complete (commit 555e424) — PNK FE force by-day
- Task 6: complete (commit b4b4f4b) — PNK resolve from BKMH slices
- Task 7: complete (tests in T6) — Phase 2 tests

## Notes
- Prior signature-system-source work complete (see older ledger entries / git log)
- Re-export BKMH months before PNK so detailRowsJson is populated
- canCuBkmh from slices may lack buyer name (not on slice metadata yet)

# SDD Progress — field-catalog-tab-and-can-cu (2026-09-04)

Plan: docs/superpowers/plans/2026-09-04-chung-tu-field-catalog-tab-and-can-cu-named-range.md
Spec: docs/superpowers/specs/2026-09-04-chung-tu-field-catalog-tab-and-can-cu-named-range-design.md

## Tasks

- Task 1: complete (commits 5a24bae..bfed5e1, review clean) — Backend FIELD_can_cu_bkmh catalog + alias
- Task 2: complete (commit a586f46, review clean) — Shared panel + Tra cứu field tabs

# SDD Progress — pnk-hide-data-unit-picker (2026-09-05)

Plan: docs/superpowers/plans/2026-09-05-pnk-hide-data-unit-picker.md
Spec: docs/superpowers/specs/2026-09-05-pnk-hide-data-unit-picker-design.md

## Tasks

- Task 1: complete (commits 154af5e..3827b7c, review clean) — PNK hide data-unit picker; omit unitIds; validator + periodMonth validate

# SDD Progress — pnk-nguoi-giao-and-date-range (2026-09-05)

Plan: docs/superpowers/plans/2026-09-05-pnk-nguoi-giao-and-date-range.md
Spec: docs/superpowers/specs/2026-09-05-pnk-nguoi-giao-and-date-range-design.md

## Tasks

- Task 1: complete (commit b6ec9f8, review clean) — Schema buyer + extraFieldsJson
- Task 2: complete (commit bbfd9b8, review clean) — Persist buyer snapshot
- Task 3: complete (commit aa87914, review clean, tests green) — PNK catalog fields + category-aware scalar mapping
- Task 4: complete (commit fbdea5a, tests green) — PNK resolve by date range and buyer split
- Task 4 review: clean (fbdea5a) — no blocker found before Task 5
- Task 5: complete (commit f9f6b59, review clean) — PNK validator date range/full mode + batch passes dates and nhapTaiKho without forcing by-day
- Task 6: complete (commit 4585e79, tests green) — PNK signature settings save nhapTaiKho and lock nguoi_giao; batch materializes buyer signature name
- Task 7: complete (commit a9156db, tests green) — PNK export UI uses date range, by-day/full picker, and sends locked nguoi_giao first
- Final review: clean after f183c01 (dateFrom/dateTo controller seam); ready to merge

