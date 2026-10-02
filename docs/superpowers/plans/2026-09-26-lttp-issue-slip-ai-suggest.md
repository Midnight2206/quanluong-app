# LTTP Issue Slip AI Suggest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users describe a phiếu xuất in natural language, preview AI-mapped header + lines, then apply into the create form without auto-posting.

**Architecture:** BE `POST /lttp/issue-slips/ai-suggest` reuses kitchen `MENU_AI_*` LLM helpers + commodity fuzzy map, enriches lines via existing resolve/price logic, returns `{ headerDraft, lines, warnings }`. FE dialog on `LttpPhieuXuatTab` (create mode only) merges via pure `applyIssueSlipAiPreview` (overwrite lines; header only if untouched).

**Tech Stack:** Express + Prisma (BE), existing `completeMenuJson` / `assertMenuAiConfigured`, React Query mutations, assert/`node:test` selfchecks.

**Spec:** `docs/superpowers/specs/2026-09-26-lttp-issue-slip-ai-suggest-design.md`

## Global Constraints

- Approach **1** — suggest → preview → FE apply (no `ai-apply`, no auto-POST).
- Button copy (exact): `AI gợi ý phiếu`
- Toast skipped lines pattern: `Đã áp dụng N dòng; bỏ qua M dòng chưa khớp LTTP` (N/M filled at runtime).
- Apply: overwrite **lines**; header only if field **untouched**.
- Create mode only (hide button when `isEditMode`).
- Reuse `MENU_AI_*` env; missing key → clear config error.
- Permission: `lttp.issue-slips.write` (same as create).
- Prefer BE `*.test.js` (node:test) and FE `*.selfcheck.mjs`; no new frameworks.
- Do not commit unless the user asks.
- Out of scope: multi-turn chat, voice, edit-mode suggest, Qdrant.

## File map

| Path | Responsibility |
|------|----------------|
| `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-enrich.js` | Map LLM JSON → headerDraft + lines; dedupe priceKind |
| `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.service.js` | Suggest orchestration + LLM prompt + history/catalog |
| `quanluong-app-be/src/modules/lttp/lttp.validator.js` | `aiSuggestIssueSlipBodySchema` |
| `quanluong-app-be/src/modules/lttp/lttp.controller.js` | Controller |
| `quanluong-app-be/src/modules/lttp/lttp.routes.js` + `lttp.route-definitions.js` | Route + permission catalog |
| `quanluong-app-be/src/middlewares/lttp-issue-slip-ai-rate-limit.middleware.js` | Rate limit (mirror menu AI) |
| `packages/shared/src/pages/lttpNhapXuat/applyIssueSlipAiPreview.js` | Pure FE merge rules |
| `packages/shared/src/pages/lttpNhapXuat/LttpIssueSlipAiSuggestDialog.jsx` | Dialog UI |
| `packages/shared/src/features/lttp/api/lttpApi.js` | `useSuggestLttpIssueSlipAiMutation` |
| `packages/shared/src/pages/lttpNhapXuat/LttpPhieuXuatTab.jsx` | Button + touched + apply |

---

### Task 1: BE enrich helpers (map + dedupe)

**Files:**
- Create: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-enrich.js`
- Create: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-enrich.test.js`

**Interfaces:**
- Consumes: `mapCommodityNameToId` from `../kitchen-books/kitchen-books-menu-ai-map.js`
- Produces: `enrichLlmIssueSlipDraft({ llm, commodities, resolveLine }) → { headerDraft, lines, warnings }`

- [ ] **Step 1: Write failing test** in `lttp-issue-slip-ai-enrich.test.js` covering: known commodity mapped + unknown unmapped; duplicate `(commodityId, priceKind)` keeps first and warns.

- [ ] **Step 2: Run** `node --test quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-enrich.test.js` — expect FAIL (module missing)

- [ ] **Step 3: Implement** `lttp-issue-slip-ai-enrich.js`:
  - Normalize `priceKind` → `market` | `tgsx`
  - `headerDraft` fields per spec (null when absent)
  - Map via `mapCommodityNameToId` (code then name)
  - Call injected `resolveLine({ commodityId, priceKind, code })` for price + supplier
  - `mapped: false` when missing commodity / qty / priceKind / supplier
  - Dedupe key `` `${commodityId}:${priceKind}` ``

- [ ] **Step 4: Re-run tests — PASS**

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-enrich.js \
  quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-enrich.test.js
git commit -m "feat(lttp): enrich helpers for issue-slip AI suggest"
```

---

### Task 2: BE suggest service + HTTP route

**Files:**
- Create: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.service.js`
- Create: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.service.test.js`
- Create: `quanluong-app-be/src/middlewares/lttp-issue-slip-ai-rate-limit.middleware.js`
- Modify: `lttp.validator.js`, `lttp.controller.js`, `lttp.routes.js`, `lttp.route-definitions.js`
- Follow `permission-vi-catalog` skill when adding the new route definition

**Interfaces:**
- Consumes: Task 1 enrich; `assertMenuAiConfigured` + `completeMenuJson` from `kitchen-books-menu-ai-llm.js`; existing resolve/price helpers from `lttp.service.js`
- Produces: `suggestIssueSlipAi(...)` + `POST /api/lttp/issue-slips/ai-suggest`

- [ ] **Step 1: Failing test** for exported `buildIssueSlipAiPrompt({ prompt, issueDate, catalogText, historyText })` — assert system mentions JSON schema; user contains prompt + catalog.

- [ ] **Step 2: Run** — expect FAIL

- [ ] **Step 3: Implement service**
  1. `assertMenuAiConfigured()`
  2. Load commodities for unit storage scope
  3. Load ~10–20 recent issue slips → short history text
  4. LLM JSON schema: `header` + `lines[{ commodityName, code, quantity, priceKind }]`
  5. `enrichLlmIssueSlipDraft` with `resolveLine` adapter using existing price/supplier resolution for `(unitId, date, commodityId, priceKind)`
  6. Return `{ headerDraft, lines, warnings, meta: { historySampleCount, model } }` — **no DB write**

- [ ] **Step 4: HTTP wiring**
  - Body: `{ unitId, prompt (3–2000), issueDate?, receivedDate?, recipientUnitId? }`
  - Permission: `LTTP_PERMISSIONS.ISSUE_SLIPS_WRITE`
  - Rate limit: mirror menu AI (`max: 10`, `windowMs: 15*60*1000`, key `lttp-issue-ai-suggest:${uid}:${ip}`)
  - Register route **before** `/:id` routes
  - Route definition key: `aiSuggestIssueSlip`

- [ ] **Step 5: Run enrich + service tests — PASS**

- [ ] **Step 6: Commit (only if user asked)** — message `feat(lttp): AI suggest endpoint for issue slips`

---

### Task 3: FE pure apply merge helper

**Files:**
- Create: `packages/shared/src/pages/lttpNhapXuat/applyIssueSlipAiPreview.js`
- Create: `packages/shared/src/pages/lttpNhapXuat/applyIssueSlipAiPreview.selfcheck.mjs`

**Interfaces:**
- Produces: `applyIssueSlipAiPreview({ header, touched, preview, newEmptyRow }) → { headerPatch, nextRows, appliedCount, skippedCount }`

- [ ] **Step 1: Selfcheck** — touched `issueDate` not patched; untouched `receivedDate`/`recipientUnitId` patched; only mapped lines with supplier become `nextRows`; `appliedCount`/`skippedCount` correct.

- [ ] **Step 2: Run** — expect FAIL

- [ ] **Step 3: Implement** per spec §2 (header untouched-only; lines full replace; match `newEmptyRow()` field names from `LttpPhieuXuatTab.jsx` exactly: `codeDraft`, `commodityId`, `quantity`, `priceKind`, `lttpSupplierId`, etc.)

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit (only if user asked)** — `feat(lttp): pure apply helper for issue-slip AI preview`

---

### Task 4: Dialog + API mutation

**Files:**
- Create: `packages/shared/src/pages/lttpNhapXuat/LttpIssueSlipAiSuggestDialog.jsx`
- Create: `packages/shared/src/pages/lttpNhapXuat/LttpIssueSlipAiSuggestDialog.contract.selfcheck.mjs`
- Modify: `packages/shared/src/features/lttp/api/lttpApi.js`

**Interfaces:**
- `useSuggestLttpIssueSlipAiMutation()` → `POST /lttp/issue-slips/ai-suggest`
- `<LttpIssueSlipAiSuggestDialog open onClose unitId issueDate onApply(preview) />`

- [ ] **Step 1: Contract selfcheck** asserts source contains `AI gợi ý phiếu` or dialog title, `ai-suggest` / mutation, `onApply`, `Áp dụng`

- [ ] **Step 2: Add mutation** following `useCreateLttpIssueSlipMutation` style in `lttpApi.js`

- [ ] **Step 3: Implement dialog** (textarea → suggest → preview header+lines → Áp dụng/Hủy; `notifyError` on failure; no Google/voice)

- [ ] **Step 4: Contract PASS**

- [ ] **Step 5: Commit (only if user asked)** — `feat(lttp): AI suggest dialog and API mutation`

---

### Task 5: Wire `LttpPhieuXuatTab`

**Files:**
- Modify: `packages/shared/src/pages/lttpNhapXuat/LttpPhieuXuatTab.jsx`
- Create: `packages/shared/src/pages/lttpNhapXuat/LttpPhieuXuatTab.ai.contract.selfcheck.mjs`

- [ ] **Step 1: Contract** asserts `AI gợi ý phiếu`, `LttpIssueSlipAiSuggestDialog`, `applyIssueSlipAiPreview`, `!isEditMode`

- [ ] **Step 2: `headerTouched` state** for `issueDate`, `receivedDate`, `recipientUnitId`, `buyerUserId`, `slipNote`; set true on user change; reset on unit change / fresh create

- [ ] **Step 3: Button + dialog** only when `!isEditMode`; onApply calls helper then setters; toast exact pattern:
  `Đã áp dụng ${appliedCount} dòng; bỏ qua ${skippedCount} dòng chưa khớp LTTP`

- [ ] **Step 4: Run all selfchecks + BE tests**

```bash
node packages/shared/src/pages/lttpNhapXuat/applyIssueSlipAiPreview.selfcheck.mjs
node packages/shared/src/pages/lttpNhapXuat/LttpIssueSlipAiSuggestDialog.contract.selfcheck.mjs
node packages/shared/src/pages/lttpNhapXuat/LttpPhieuXuatTab.ai.contract.selfcheck.mjs
node --test quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-enrich.test.js \
  quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.service.test.js
```

- [ ] **Step 5: Manual smoke** — suggest → apply → save; edit mode hides button; touched date preserved

- [ ] **Step 6: Commit (only if user asked)** — `feat(lttp): wire AI suggest into phiếu xuất create form`

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| `POST .../ai-suggest` | 2 |
| Response shape | 1–2 |
| Reuse MENU_AI_* + rate-limit | 2 |
| No DB write on suggest | 2 |
| Dialog preview → apply | 4–5 |
| Create mode only | 5 |
| Header untouched / lines overwrite | 3, 5 |
| Toast skipped lines | 5 |
| Fuzzy map + resolve | 1–2 |
| Multi-turn / voice deferred | out of scope |
