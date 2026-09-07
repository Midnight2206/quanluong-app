# Task 9-11 Report — Chung tu FE batch export folders + signature settings

**Status:** completed

## Delivered

- Extended `packages/shared/src/features/chung-tu-quyet-toan/api/chungTuPdfApi.js` with batch export hooks/actions, signature settings hooks, and PDF field catalog query support.
- Added `packages/shared/src/pages/chungTuQuyetToan/ChungTuSignatureSettingsWorkspace.jsx` and registered the new `Cài đặt chữ ký` sub-tab in `ChungTuCategoryWorkspace.jsx`.
- Updated `ChungTuExportWorkspace.jsx` to create PDF export batches, surface created `fileCount`, prefer saved category-level signature block settings, and show a collapsible Named Range help panel.
- Reworked `ChungTuHistoryWorkspace.jsx` from legacy single-file history into folder-style batch history with expand-to-files UI and actions for `Tải zip`, `In tất cả`, `Tải file`, and `Xóa batch`.
- Added new React Query keys in `packages/shared/src/app/query/queryKeys.js` for batch exports, signature settings, and the field catalog.

## Verification

- `ReadLints` on edited FE files: clean.
- `npm run build:web`: pass.
- Tried command-line ESLint on the changed files, but the repo root does not expose an `eslint.config.*`, so that check was not usable here.

## Commit

- `feat(chung-tu): FE batch export folders and signature settings`

## Concerns

- `In tất cả` relies on opening a browser tab with a merged PDF blob and then calling `print()`. On some browsers/viewers, the auto-print step may be delayed or require the user to press `Ctrl/Cmd+P`; the UI now tells the user that fallback.
- I did not manually exercise the live batch export endpoints against a running backend/document-service stack in this session, so runtime validation of zip / merged PDF / single-file download still depends on environment-backed smoke testing.
