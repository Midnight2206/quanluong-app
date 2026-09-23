# SDD Progress — pxk-lttp-fields-signatures (2026-09-07)

Plan: docs/superpowers/plans/2026-09-07-pxk-lttp-fields-signatures.md

## Tasks

- Task 1: complete (commits 09413c7..6c129a6, review clean)
- Task 2: complete (commits 6c129a6..653e080, review clean)
- Task 3: complete (commits 653e080..5f89661, review clean)
- Task 4: complete (commits 5f89661..88aad45, review clean)
- Final review: Ready to merge (88aad45); Important non-blocking: BE default by-day when aggregationMode omitted for PXK API

# SDD Progress — pnk-folder-pdf-summary (2026-09-06)

Plan: docs/superpowers/plans/2026-09-06-pnk-folder-pdf-summary.md

## Tasks

- Task 1: complete (commits 4b546f3..a2630b1, review clean)
- Task 2: complete (commits a2630b1..3cdb42e, review clean)
- Task 3: complete (commits 3cdb42e..7bc65b6, review clean)

# SDD Progress — template-field-labels-from-excel-fields (2026-09-05)

Plan: docs/superpowers/plans/2026-09-05-template-field-labels-from-excel-fields.md
Spec: docs/superpowers/specs/2026-09-05-template-field-labels-from-excel-fields-design.md

## Tasks

- Task 1: complete (commit d3d6865) — backend `normalizeFieldLabels` accepts any string keys (no `supportsLabel` whitelist)
- Task 2: complete (tests green) — FE template-scoped `FIELD_*` label list, prune-save payload, shared scalar key resolver

# SDD Progress — template-field-labels-and-catalog-lookup (2026-09-05)

Plan: docs/superpowers/plans/2026-09-05-template-field-labels-and-catalog-lookup.md
Spec: docs/superpowers/specs/2026-09-05-template-field-labels-and-catalog-lookup-design.md
## Tasks

- Task 1: complete (commit 5c7c5b2) — fieldLabelsJson schema + migration
- Task 2: complete (commit 0cbf70a) — catalog metadata + label-driven scalar formatting
- Task 3: complete (commit 5edb2f3) — export paths pass template fieldLabelsJson
- Task 4: complete (commit c3c55d2, tests green) — API save/filter field labels on PDF templates
- Task 5: complete (commit df6492a, source tests green) — Superadmin per-template field-label editor
- Task 6: complete (commit 41d6fca, source tests green) — searchable scalar-only field catalog table

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

# SDD Progress — multi-row-table-header (2026-09-05)

Plan: docs/superpowers/plans/2026-09-05-multi-row-table-header.md
Spec: docs/superpowers/specs/2026-09-05-multi-row-table-header-design.md

## Tasks

- Task 1: complete (tests green) — document-service importer supports multi-row `TABLE_HEADER`; bottom-row keys, vertical-merge title fallback, summed header height; `TABLE_DATA_ROW` remains single-row

# SDD Progress — nl-field-can-cu-pnk (2026-09-05)

Plan: `docs/superpowers/plans/2026-09-05-nl-field-can-cu-pnk.md`
Spec: `docs/superpowers/specs/2026-09-05-nl-field-can-cu-pnk-design.md`

## Tasks

- Task 1: complete (tests green) — BE shared named-range prefix helper, `NL_FIELD_can_cu_pnk` formatter/catalog module, label-field module, and named-range-display compatibility re-export

# SDD Progress — superadmin-dashboard-tabs-to-sidebar (2026-09-06)

Plan: docs/superpowers/plans/2026-09-06-superadmin-dashboard-tabs-to-sidebar.md
Spec: docs/superpowers/specs/2026-09-06-superadmin-dashboard-tabs-to-sidebar-design.md

## Tasks

- Task 1: complete (commits eb0ebf0..76636eb, review clean) — superadmin-dashboard-tabs-to-sidebar
- Task 2: complete (commits 76636eb..0169de8, review clean)
- Task 3: complete (commits 0169de8..4b6ed1a, review clean)
- Task 4: complete (commits 4b6ed1a..2b07caa, review clean)
- Final review: Important mobile flex-1 fixed (91ec544); remaining Minors deferred (orphan section headers, aria-label, DEP0205, meta comment)


# SDD Progress — chung-tu-doc-number-and-reexport (2026-09-07)

Plan: docs/superpowers/plans/2026-09-07-chung-tu-doc-number-and-reexport.md
Spec: docs/superpowers/specs/2026-09-07-chung-tu-doc-number-and-reexport-design.md

## Tasks

- Task 1: complete (commits 2a27560..15fb79a, review clean) — Prisma counter/assignment + allocateDocNumber
- Task 2: complete (commits 15fb79a..6e7d57c, controller self-review — Task tool blocked) — wire allocate into resolver
- Task 3: complete (commits 6e7d57c..1731baf, controller self-review) — DELETE /v1/folders/{id}/files + Node client
- Task 4: complete (commits 1731baf..0cd6013, controller) — contextJson on batch export create; BKMH numbers via Task 2 resolve
- Task 5: complete (commits 0cd6013..143dbd1, controller) — POST .../pdf-export-batches/:batchKey/re-export
- Task 6: complete (commits 143dbd1..38446fc, controller) — BKMH re-export + create no longer replaces folder
- Task 7: complete (commit 090ed38) — FE Xuất lại dialog + History actions + API hooks
- Task 8: complete (acceptance tests green with `--experimental-test-module-mocks`) — re-export keeps folder/numbers; BKMH create rejects duplicate; allocate independent counters; no mmyydd

## Notes
- Deploy needs `prisma migrate deploy` for doc-number tables + `contextJson`
- Manual UI smoke still useful: History → Xuất lại trên BKMH/PNK/PXK
- Task tool blocked mid-run; Tasks 2–8 continued inline with controller self-review
# SDD Progress — superadmin-post-login-portal-chooser (2026-09-07)

Plan: docs/superpowers/plans/2026-09-07-superadmin-post-login-portal-chooser.md
Spec: docs/superpowers/specs/2026-09-07-superadmin-post-login-portal-chooser-design.md

## Tasks

Task 1: complete (commits 309fb51..7185162, controller self-review — Task reviewer billing blocked)
Task 2: complete (commits 7185162..8e07fe5, controller self-review — Task reviewer billing blocked)
Task 3: complete (commits 8e07fe5..ca0a283, controller self-review — Task reviewer billing blocked)
Task 4: complete (commits ca0a283..7ba0d34, controller self-review — Task reviewer billing blocked)
Task 5: complete (automated suite 7/7 pass; controller smoke; Task reviewer billing blocked)
Final review: portal-chooser Tasks 1–5 complete (7185162..7ba0d34); automated 7/7; per-task Task reviewers skipped (billing)

# SDD Progress — client-indexeddb-persistence (2026-09-22)

Plan: docs/superpowers/plans/2026-09-22-client-indexeddb-persistence.md
Spec: docs/superpowers/specs/2026-09-22-client-indexeddb-persistence-design.md
Branch: feat/document-service-p4 (in-place; no commits until user asks)
BASE_AT_START: 1c0b99c2ffea1d7e49c6ea5b58ad81863c47761f

## Tasks

- Task 1: complete (uncommitted working tree, review clean) — keys.js, db.js, clearClientDb, idb-keyval dep; Minors: lockfile churn, clear onblocked, no package export yet
- Task 2: complete (uncommitted, review clean) — pageUi/drafts + migrate; Minors: lich-su selfcheck, migrate validation, setDraft spread overwrite
- Task 3: complete (uncommitted, review clean after debounce fix) — useDraftPersist + LTTP tabs + provider stub; Step 4 smoke → Task 9
- Task 4: complete (uncommitted, review clean) — usePageUiPersist + LTTP scroll; Minors: debounce flush on leave, restore timing
- Task 5: complete (uncommitted, review clean) — logout await clearClientDb; Minor: session-expiry no wipe
- Task 6: complete (uncommitted, review clean) — RQ catalog persist allowlist; Minors: superadmin deps, session-expiry RQ clear
- Task 7: complete (uncommitted, review clean X1) — create-only outbox; Minors: backoff, stuck sending recovery
- Task 8: complete (uncommitted, review clean after dashboard IDB hydrate fix) — nav dual-write + MainLayout scroll; Minor: superadmin no provider
- Task 9: complete (uncommitted) — selfchecks green; manual browser smoke SKIP (needs user)
- Final review: Ready with follow-ups → fixed Important (sending recovery, wipeClientPersist on logout/session/user-switch, superadmin provider+deps); remaining Minors deferred; manual browser smoke still SKIP

# SDD Progress — offline-first-architecture (2026-09-23)

Plan: docs/superpowers/plans/2026-09-23-offline-first-architecture.md
Spec: docs/superpowers/specs/2026-09-23-offline-first-architecture-design.md
Branch: feat/client-indexeddb-persistence (in-place; no commits until user asks)
BASE_AT_START: 1c0b99c2ffea1d7e49c6ea5b58ad81863c47761f

## Tasks

- Task 1: complete (uncommitted, review clean) — Dexie schema/open; Important for T2: clearOfflineDb(userId), close on switch
- Task 2: complete (uncommitted, review clean) — OfflineProvider + wipe clearOfflineDb(userId); Minor: selfcheck coverage
- Task 3: complete (uncommitted, review clean) — SWR httpCache + prefetch; Minors: fetcher deps, stale flag on error
- Task 4: complete (uncommitted, controller accept) — OfflineBanner + useNetworkStatus
- Task 5: complete (uncommitted, controller accept) — Serwist apps/web; SW off in next dev; register post-login
- Task 6: complete (uncommitted, controller accept) — outbox processor + sync controller + useOfflineQueue
- Task 7: complete (uncommitted, controller accept) — blob quota + upload/import + OutboxBadge
- Task 8: complete (uncommitted, controller accept) — ConflictReviewDialog + keepServer/reapply
- Task 9: complete (uncommitted, review clean after baseVersion fix) — LTTP Dexie outbox; Minor: orphan X1 IDB rows not migrated
- Task 10: complete (uncommitted) — 7/7 selfchecks; manual browser smoke SKIP; Docker UI rebuild needed
- Final review: Ready with follow-ups; fixed enqueue→offline-outbox-changed; remaining: Docker UI rebuild, manual smoke, RQ→SWR hook migrate, orphan X1 rows


# SDD Progress — reconnect-gate-and-field-marks (2026-09-23)

Plan: docs/superpowers/plans/2026-09-23-reconnect-gate-and-field-marks.md
Spec: docs/superpowers/specs/2026-09-23-reconnect-gate-and-field-marks-design.md
BASE_BEFORE_T1: c353bcafb5a3fdec8cbb0dedf0e6cf6b33be8f83

## Tasks

- Task 1: complete (commits c353bca..4411638, review clean)
- Task 2: complete (commits 4411638..ca75c4d, review clean)
- Task 3: complete (commits ca75c4d..2eea439, review clean)
- Task 4: complete (commits 2eea439..6af671b, review clean; minor: partial flush unlock / sawOffline user switch)
- Task 5: complete (commits 6af671b..3710106, review clean; minor: manual navigate smoke pending)
- Task 6: complete (commits 3710106..57f8cfa, selfchecks 6/6; browser smoke SKIPPED)
- Final review: Ready with follow-ups; Important fixed in 3566d74 (partial flush / userId reset / 45s timeout). Browser §6 still manual.
- Final fix: 3566d74 (failed flush blocks gate; userId reset; 45s timeout). All 6 selfchecks ok.


# SDD Progress — outbox-auth-expired-reauth (2026-09-23)

Plan: docs/superpowers/plans/2026-09-23-outbox-auth-expired-reauth.md
Spec: docs/superpowers/specs/2026-09-23-outbox-auth-expired-reauth-design.md
Branch: feat/client-indexeddb-persistence
BASE_BEFORE_T1: da7f8b864ef796f052fc1a348e15b12cc73f7fee

## Tasks

- Task 1: complete (commits da7f8b8..6916f3f, review clean; minors: 403 fallback string untested, 401/403 on non-create-like thinner)
- Task 2: complete (commits 6916f3f..c9551e1, review clean; minors: setAuthState coverage, missing apiRequest TypeError)
- Task 3: complete (commits c9551e1..1c949a3, review clean; minors: concurrent test implicit verify)
- Task 4: complete (commits 1c949a3..17346d9, review clean)
- Task 5: complete (commits 17346d9..7cfccf3, review clean; minors: contract coverage, a11y)
- Task 6: complete (commits 7cfccf3..9049f75, review Approved; Important notes deferred: pre-ready bypass per plan, manual smoke SKIP)
- Final review: Ready with follow-ups (manual browser smoke SKIP; non-401 verify→AUTH_EXPIRED accepted per spec; minors deferred)
