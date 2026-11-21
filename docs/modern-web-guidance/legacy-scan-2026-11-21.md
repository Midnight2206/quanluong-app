# Legacy scan — 2026-11-21

Scan only. No application code was changed.

## How this was run

CLI: `npx modern-web-guidance@latest` **1.0.1** (`legacy-scan <path> --json`).

| Path | Raw findings | Docs/tests skipped |
| --- | ---: | ---: |
| `apps/web` | 2 | 1 |
| `apps/superadmin` | 1 | 2 |
| `apps/supplier` | 1 | 0 |
| `packages/shared` | 20 | 57 |

The scanner checked 38 guides (52 deterministic rules), about 20% of the catalog. Backend (`quanluong-app-be`), Docker, Python services, and other trees were not scanned.

Each hit was checked against that rule's `keepWhen` / `dropWhen` in the surrounding source. **23 kept, 1 dropped.**

## Resolution

All 23 kept findings are **fixed** on this branch. Layout classes, PDF export, the backend, and Docker files are unchanged. A re-scan of `apps/web`, `apps/superadmin`, `apps/supplier`, and `packages/shared` reports one remaining hit: the dropped `Set` spread in `AdminJobTitlesPanel.jsx`. `toSorted()` is used when the engine has it. Next 15.5's compiler floor (`chrome 64`, `edge 79`, `firefox 67`, `opera 51`, `safari 12` in `modern-browserslist-target.js`) does not include `Array.prototype.toSorted` and does not polyfill it, so `toSortedCopy` falls back to copy-then-sort on those engines.

| Status | Finding | Where |
| --- | --- | --- |
| Fixed | IME Enter | `MessengerChatDock.jsx`, `LttpIssueSlipAiSuggestDialog.jsx`, `KitchenReceiptSlipWorkspace.jsx`, `LttpPhieuXuatTab.jsx` (desktop row and the mobile card code field, same handler) via `imeEnterAction` |
| Fixed | `autocomplete="current-password"` | `apps/web/app/midnight-secret/MidnightGateForm.jsx` |
| Fixed | copy-then-sort | 14 call sites go through `packages/shared/src/utils/toSortedCopy.js` |
| Fixed | `{ cause: firstErr }` | `apps/web/next.config.mjs`, `apps/superadmin/next.config.mjs`, `apps/supplier/next.config.mjs` |
| Fixed | `Promise.withResolvers()` | `OfflineSyncController.selfcheck.mjs` (Node 22.23.4 in the UI/backend images) |
| Dropped, unchanged | `[...draftSet].sort` | `AdminJobTitlesPanel.jsx` — `draftSet` is a `Set` |

## Dropped

| Finding | File | Why |
| --- | --- | --- |
| `js/copying-array-methods` — `[...draftSet].sort(...)` | `packages/shared/src/pages/dashboard/admin/AdminJobTitlesPanel.jsx:78` | `draftSet` is a `Set` (`permDraft` from `useState(() => new Set())`). `dropWhen` excludes spread of a non-array iterable. The next line, on `ids`, is a real array and is kept. |

## Kept, by priority

Replacement text comes from the scan message and, for IME and sign-in, from `retrieve` of `ime-safe-enter-submit` and `autofill-sign-in-form`. Risk is the cost of changing it later, not a severity score from the scanner.

### 1. IME-unsafe Enter on chat composers — high

Status: **fixed.** `imeEnterAction` preventDefaults, then submits only when the key is not an IME confirm (`isComposing` or `keyCode === 229`). Shift+Enter still inserts a newline.

`isComposing` is limited availability (unsupported in Safari). The guide's recommended fallback is `event.isComposing || event.keyCode === 229` before submit, still calling `preventDefault()` so a textarea does not also insert a newline. Vietnamese IME (including iOS) uses Enter to confirm a composition. These handlers send on that key.

| Finding | File | Suggested replacement | Risk | Affects mobile? |
| --- | --- | --- | --- | --- |
| `ime-safe-enter-submit` — `Enter` sends the draft with no composition check | `packages/shared/src/layouts/components/MessengerChatDock.jsx:662` | Return early when `e.isComposing \|\| e.keyCode === 229` before `handleSend()`. Keep Shift+Enter as newline. | Medium. Easy to drop a real send if the guard is too wide; Safari needs the `229` check or messages send mid-composition. | Yes. Chat is typed on the phone keyboard. |
| Same, on the phiếu xuất AI composer | `packages/shared/src/pages/lttpNhapXuat/LttpIssueSlipAiSuggestDialog.jsx:841` | Same guard before `handleChat()` / `handleSuggest()`. Placeholder copy is Vietnamese (`trứng vịt`), so composition is the normal path. | Same as above. | Yes. |

### 2. IME-unsafe Enter on ledger code fields — medium

Status: **fixed.** Same helper, without the Shift+Enter exception. The mobile phiếu xuất code field (`onCodeKeyDown`) uses it too; the original scan only saw the desktop input.

Both match `keepWhen`: a keydown on a text input treats Enter as submit/search (`resolveByCode`) and does not check `isComposing` or `keyCode === 229`. Codes are often ASCII, so this fires less often than chat, but the sổ screens are used under 1024px.

| Finding | File | Suggested replacement | Risk | Affects mobile? |
| --- | --- | --- | --- | --- |
| `ime-safe-enter-submit` on the receipt-slip code input | `packages/shared/src/pages/kitchen-books/KitchenReceiptSlipWorkspace.jsx:713` | Same composition guard before `resolveByCode`. No Shift+Enter exception on a single-line input. | Low. A missed lookup is recoverable; a premature lookup can focus the quantity cell mid-composition. | Yes. |
| Same, on the phiếu xuất code input | `packages/shared/src/pages/lttpNhapXuat/LttpPhieuXuatTab.jsx:2441` | Same guard. | Low. | Yes. |

### 3. Sign-in password with `autocomplete="off"` — medium

Status: **fixed.** `autoComplete="current-password"` plus a stable `id` and `name`. Layout classes are unchanged.

`keepWhen` matches: a user-facing password form sets `autoComplete="off"`, which blocks the password manager. The guide says a sign-in password must use `autocomplete="current-password"`, with a stable `id`/`name`, inside a `<form>` that has a submit button.

| Finding | File | Suggested replacement | Risk | Affects mobile? |
| --- | --- | --- | --- | --- |
| `autofill-sign-in-form` | `apps/web/app/midnight-secret/MidnightGateForm.jsx:44` | `autoComplete="current-password"` (and a stable `name`/`id`) if this should participate in the password manager. | Medium. Copy says this is a shared internal gate (`mật khẩu nội bộ`), so `off` may be deliberate. `current-password` can offer to store that shared secret. Confirm before changing. | Yes. The gate is a full-viewport form (`h-dvh`); mobile password managers are the point of the attribute. |

### 4. Copy-then-sort instead of `toSorted()` — low

Status: **fixed** through `toSortedCopy`, which calls `toSorted` when it exists.

`keepWhen` matches: an array is copied with spread and then `.sort()`. No `tsconfig` target older than ES2023, and no `engines.node < 20`, so the pre-ES2023 `dropWhen` does not apply. `toSorted()` is Baseline widely available. Behavior stays a new array; the original is already not mutated.

| Finding | File | Suggested replacement | Risk | Affects mobile? |
| --- | --- | --- | --- | --- |
| `js/copying-array-methods` | `packages/shared/src/pages/dashboard/admin/AdminJobTitlesPanel.jsx:51` | `units.toSorted(...)` | Low. Equivalent on current Next 15 browsers. | No. |
| Same pattern on permission id arrays | `packages/shared/src/pages/dashboard/admin/AdminJobTitlesPanel.jsx:79` | `(ids ?? []).toSorted(...)`. Line 78 was dropped (it is a `Set`). | Low. | No. |
| Same unit-path sort | `packages/shared/src/pages/dashboard/admin/AdminLttpPanel.jsx:86` | `(units \|\| []).toSorted(...)` | Low. | No. |
| Same | `packages/shared/src/pages/dashboard/superadmin/SuperadminPermissionMatrixPanel.jsx:17` | `units.toSorted(...)` | Low. | No. |
| Same | `packages/shared/src/pages/dashboard/superadmin/SuperadminUnitsPanel.jsx:32` | `units.toSorted(...)` | Low. | No. |
| Same | `packages/shared/src/pages/dashboard/superadmin/SuperadminUsersPanel.jsx:38` | `units.toSorted(...)` | Low. | No. |
| Same | `packages/shared/src/pages/kitchen-books/KitchenBooksPage.jsx:54` | `(units \|\| []).toSorted(...)` | Low. | No. |
| Copy-then-sort of a 3-element meal split | `packages/shared/src/pages/kitchen-books/ledgerMealSplit.js:11` | `floors.toSorted(...)`. The loop then mutates `order[i].amount`, which still works because the objects are shared. | Low. Do not switch to a sort that clones the row objects. | No. |
| Same unit-path sort | `packages/shared/src/pages/lttpNhapXuat/LttpNhapXuatPage.jsx:31` | `(units \|\| []).toSorted(...)` | Low. | No. |
| Sort grand totals by Vietnamese name | `packages/shared/src/pages/lttpNhapXuat/lttpOrderingMatrix.js:93` | `(summary.grandTotals \|\| []).toSorted(...)` | Low. | No. |
| Same unit-path sort | `packages/shared/src/pages/lttpNhapXuat/lttpStorageUnitDefault.js:5` | `(units \|\| []).toSorted(...)` | Low. | No. |
| Same | `packages/shared/src/pages/meal-roster/MealRosterPage.jsx:20` | `(units \|\| []).toSorted(...)` | Low. | No. |
| Sort rate versions by `validFrom` | `packages/shared/src/pages/meal-roster/mealRosterUiUtils.jsx:139` | `versions.toSorted(...)` (already guarded by `Array.isArray`) | Low. | No. |
| Shared helper used by the unit selects above | `packages/shared/src/utils/unitTreeFlatSelect.js:3` | `(units \|\| []).toSorted(...)` | Low. Fixing this once covers callers that go through `sortUnitsByMaterializedPath`. | No. |

### 5. `new Error` concatenates `err.message` and drops the cause — low

Status: **fixed.** The message text is unchanged and `{ cause: firstErr }` is the second argument.

`keepWhen` matches: a built-in `Error` folds `firstErr?.message` into the string and does not pass `{ cause: firstErr }`. This is build config, not an HTTP trust boundary, so the strip-at-the-boundary `dropWhen` does not apply. Keep the existing message text; add the cause as the second argument.

| Finding | File | Suggested replacement | Risk | Affects mobile? |
| --- | --- | --- | --- | --- |
| `js/error-cause` while resolving `html-to-image` | `apps/web/next.config.mjs:33` | `throw new Error(message, { cause: firstErr })` | Low. Build-time only. Callers read the message, not own-keys of the error. | No. |
| Same | `apps/superadmin/next.config.mjs:21` | Same | Low. | No. |
| Same | `apps/supplier/next.config.mjs:21` | Same | Low. | No. |

### 6. Deferred `new Promise` in a Node self-check — low

Status: **fixed.** `const { promise: gate, resolve: release } = Promise.withResolvers()`. The self-check still prints `OfflineSyncController: ok` on Node 22.

`keepWhen` matches: the executor only assigns `resolve` to an outer `release`. Not a polyfill, and nothing in the file targets a pre-ES2024 runtime. The file is a Node assert script (`import assert from "node:assert/strict"`), not UI. The scanner's test skip did not match the `*.selfcheck.mjs` name.

| Finding | File | Suggested replacement | Risk | Affects mobile? |
| --- | --- | --- | --- | --- |
| `js/promise-with-resolvers` | `packages/shared/src/offline/sync/OfflineSyncController.selfcheck.mjs:6` | `const { promise: gate, resolve: release } = Promise.withResolvers()` | Low. Node-only check. `Promise.withResolvers` needs Node 22. | No. |

## What this scan does not cover

Dialogs, popovers, scroll, layout, and most CSS were not in the 52 deterministic rules. A later pass would `search` those topics. Do not treat a clean rule here as a clean file.
