# LTTP issue-slip AI suggest — final review fix

**Commit:** `0387f10` — `fix(lttp): map TGSX AI preview price into tgsxPrice on apply`

**Status:** Done.

**Tests:** `applyIssueSlipAiPreview.selfcheck.mjs`, `LttpIssueSlipAiSuggestDialog.contract.selfcheck.mjs`, `LttpPhieuXuatTab.ai.contract.selfcheck.mjs` — all PASS.

**Scope:** `applyIssueSlipAiPreview.js` (TGSX `tgsxPrice` fallback from `unitPrice`); dialog + tab pass `receivedDate` / `recipientUnitId` to suggest API. Mobile wizard AI entry not touched.

---

# LTTP AI memory+chat — whole-branch review fixes

**Commit:** `fix(lttp): AI memory commit/link schema + rate-limit + PDF order`

**Status:** Done.

**Tests:** 
- `node --test quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai*.test.js` — PASS (`24/24`)
- `node packages/shared/src/pages/lttpNhapXuat/LttpIssueSlipAiSuggestDialog.contract.selfcheck.mjs` — PASS
- `node packages/shared/src/pages/lttpNhapXuat/LttpPhieuXuatTab.ai.contract.selfcheck.mjs` — PASS

**Scope:** removed invalid `updatedById` writes from AI memory commit/link; require positive `actorUserId` before creating AI memory and updated tests; moved commit/link endpoints to a looser DB-only limiter; preserved suggest sample-count badges across chat turns; opened saved PDF before background memory-link call and downgraded link failure to a soft warning toast.
