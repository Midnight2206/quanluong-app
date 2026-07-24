# Kitchen Menu AI Suggest (Day) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add «AI gợi ý ngày» on Sổ thực đơn: BE RAG+LLM suggest → preview dialog → apply all 3 meals into `KitchenMenuDay`.

**Architecture:** Server-side agent only. `ai-suggest` loads global menu history samples + local LTTP/catalog into a prompt, calls LLM via env-configured provider, parses JSON, fuzzy-maps commodity names to local `commodityId`. `ai-apply` filters to mapped lines and writes three periods via existing `putMenuPeriod` logic. No schema migration; no fine-tune/vector DB in MVP.

**Tech Stack:** Node.js/Express kitchen-books module, Prisma, `fetch` to OpenAI-compatible Chat Completions (or Gemini REST if provider=`gemini`), React dialog on `KitchenMenuTab`, TanStack Query, `node:test`.

**Spec:** `docs/superpowers/specs/2026-07-24-kitchen-menu-ai-suggest-design.md`

## Global Constraints

- Permission: `kitchenBooks.access` only (reuse existing code).
- LLM API keys only on server (`MENU_AI_*` env); never expose to FE.
- LLM must not write DB; only `ai-apply` after user confirm.
- Apply: write only lines with `mapped === true` and valid local `commodityId`; report dropped count.
- Learn from **all** `KitchenMenuDay` rows system-wide; map commodities to **current** `storageUnitId`.
- No new npm dependency if `fetch` + OpenAI-compatible HTTP is enough; do not add vector DB.
- YAGNI: no chat (C), no weekly plan (B), no in-dialog editing.

## File map

| File | Role |
|------|------|
| `quanluong-app-be/src/config/env.js` + `config.js` | `menuAi` config block |
| `quanluong-app-be/.env.example` + `.env.docker.example` | Document `MENU_AI_*` |
| `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai-map.js` | Normalize + fuzzy map commodity names |
| `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai-map.test.js` | Unit tests for map |
| `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai-history.js` | Sample N recent menus (+ prefer same weekday) → compact text |
| `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai-history.test.js` | Pure tests on formatter (fixture rows) |
| `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai-llm.js` | Provider client + JSON extract/parse/retry once |
| `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai-llm.test.js` | Parse/retry with mocked `fetch` |
| `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai.service.js` | `suggestMenuDay` + `applyMenuDayAi` |
| `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai.service.test.js` | Map+filter apply payload; mock LLM |
| `quanluong-app-be/src/modules/kitchen-books/kitchen-books.validator.js` | Zod bodies for suggest/apply |
| `quanluong-app-be/src/modules/kitchen-books/kitchen-books.route-definitions.js` | Two route defs |
| `quanluong-app-be/src/modules/kitchen-books/kitchen-books.controller.js` | Controllers |
| `quanluong-app-be/src/modules/kitchen-books/kitchen-books.routes.js` | Wire routes + suggest rate-limit |
| `quanluong-app-be/src/middlewares/menu-ai-rate-limit.middleware.js` | Tight rate limit for suggest |
| `packages/shared/.../kitchenBooksApi.js` + `queryKeys.js` | Mutations/invalidation |
| `packages/shared/.../KitchenMenuAiSuggestDialog.jsx` | Preview UI |
| `packages/shared/.../KitchenMenuTab.jsx` | Button + dialog wiring |

---

### Task 1: Commodity name fuzzy map (pure)

**Files:**
- Create: `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai-map.js`
- Test: `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai-map.test.js`

**Interfaces:**
- Produces:
  - `normalizeCommodityName(name: string): string` — lowercase, trim, collapse spaces, strip diacritics-ish (NFD + remove combining marks).
  - `mapCommodityNameToId(name: string, commodities: {id:number,name:string,code?:string}[]): { commodityId: number|null, mapped: boolean, matchedName: string|null }` — exact normalized name, else exact code, else single includes-match if unambiguous.

- [ ] **Step 1: Write failing tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { mapCommodityNameToId, normalizeCommodityName } from "./kitchen-books-menu-ai-map.js";

test("normalize strips case and diacritics", () => {
  assert.equal(normalizeCommodityName("  Gạo Tẻ  "), normalizeCommodityName("gao te"));
});

test("exact name maps", () => {
  const r = mapCommodityNameToId("Gạo tẻ", [{ id: 1, name: "Gạo tẻ", code: "GAO" }]);
  assert.equal(r.commodityId, 1);
  assert.equal(r.mapped, true);
});

test("unknown returns null", () => {
  const r = mapCommodityNameToId("XYZ", [{ id: 1, name: "Gạo tẻ" }]);
  assert.equal(r.mapped, false);
  assert.equal(r.commodityId, null);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd quanluong-app-be && node --test src/modules/kitchen-books/kitchen-books-menu-ai-map.test.js
```

- [ ] **Step 3: Implement map helpers**

Implement `normalizeCommodityName` and `mapCommodityNameToId` as specified above. Keep file free of Prisma/LLM.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd quanluong-app-be && node --test src/modules/kitchen-books/kitchen-books-menu-ai-map.test.js
```

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai-map.js \
  quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai-map.test.js
git commit -m "feat(kitchen): fuzzy map tên LTTP cho AI thực đơn"
```

---

### Task 2: History sampler + prompt text (pure format)

**Files:**
- Create: `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai-history.js`
- Test: `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai-history.test.js`

**Interfaces:**
- Produces:
  - `selectHistoryDayIds(days: {id,menuDate:Date}[], targetDate: Date, limit=45): number[]` — prefer same `getUTCDay()`, fill with most recent.
  - `formatMenuHistoryForPrompt(days: Array<{menuDate:string, periods: Record<string,{dishes:Array<{name,lines:Array<{commodityName,calcMode,perPersonAmount,perPersonUnit,peoplePerUnit}>}>}>}>): string`
  - `formatLocalCatalogForPrompt(commodities, catalogDishes): string`

- [ ] **Step 1: Write failing tests** for weekday preference and compact text containing dish/commodity names.

- [ ] **Step 2: Run — expect FAIL**

```bash
cd quanluong-app-be && node --test src/modules/kitchen-books/kitchen-books-menu-ai-history.test.js
```

- [ ] **Step 3: Implement selectors/formatters** (no DB in this file).

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(kitchen): format lịch sử thực đơn cho RAG prompt"
```

---

### Task 3: Env config + LLM client

**Files:**
- Modify: `quanluong-app-be/src/config/env.js`, `quanluong-app-be/src/config/config.js`
- Modify: `quanluong-app-be/.env.example`, `quanluong-app-be/.env.docker.example`
- Create: `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai-llm.js`
- Test: `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai-llm.test.js`

**Interfaces:**
- Config `config.menuAi = { provider, apiKey, model, baseUrl, timeoutMs }` from:
  - `MENU_AI_PROVIDER` (`openai` | `gemini`, default `openai`)
  - `MENU_AI_API_KEY` (empty = disabled)
  - `MENU_AI_MODEL` (default `gpt-4o-mini` or `gemini-2.0-flash`)
  - `MENU_AI_BASE_URL` (optional; OpenAI-compatible default `https://api.openai.com/v1`)
  - `MENU_AI_TIMEOUT_MS` (default `60000`)
- Produces:
  - `assertMenuAiConfigured()` — throws `AppError` 503 if no key
  - `extractJsonObject(text: string): object` — strip ``` fences; `JSON.parse`; throw on fail
  - `completeMenuJson({ system, user }, { fetchImpl } = {}): Promise<object>` — one retry if parse fails (ask model to return JSON only)
  - Expected LLM JSON shape:

```json
{
  "periods": {
    "sang": { "dishes": [{ "name": "...", "lines": [{ "commodityName": "...", "calcMode": "per_person", "perPersonAmount": 100, "perPersonUnit": "g", "peoplePerUnit": null }] }] },
    "trua": { "dishes": [] },
    "chieu": { "dishes": [] }
  }
}
```

- [ ] **Step 1: Write tests** for `extractJsonObject` (raw JSON + fenced) and `completeMenuJson` with mocked fetch returning bad then good JSON (retry once).

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Add env/config + implement LLM client**

OpenAI path: `POST {baseUrl}/chat/completions` with `response_format: { type: "json_object" }` when provider is openai. Gemini: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=`. Keep both thin; if timeboxed, implement **openai-compatible only** and document gemini as follow-up — but prefer both if small.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(kitchen): cấu hình MENU_AI và client LLM JSON"
```

---

### Task 4: `suggestMenuDay` + `applyMenuDayAi` service

**Files:**
- Create: `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai.service.js`
- Test: `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai.service.test.js`
- Modify: export from service; reuse `putMenuPeriod` from `kitchen-books-menu.service.js`

**Interfaces:**
- Consumes: history formatters, map, LLM, `prisma`, scope helpers (`assertKitchenLogicalMatchesDataScope`, `assertKitchenWriteUnit`), `putMenuPeriod`
- Produces:
  - `suggestMenuDay({ unitId, date }, scope, effectiveUnitIds, dataScope, { completeMenuJson }?)`
  - `applyMenuDayAi({ unitId, date, periods }, scope, effectiveUnitIds, dataScope)`
  - `filterMappedPeriods(periods): { periods, droppedLineCount }` — pure helper exported for tests

**suggest flow:**
1. Scope asserts; `assertMenuAiConfigured()`.
2. Load up to ~80 recent `kitchenMenuDay` ids globally (with periods/dishes/lines/commodity names); `selectHistoryDayIds` → format.
3. Load local commodities + catalog for `storageUnitId`; format.
4. Call LLM; map each line via `mapCommodityNameToId`; collect `warnings` for unmapped + low history.
5. Return `{ periods, warnings, meta: { historySampleCount } }`.

**apply flow:**
1. `filterMappedPeriods` — drop unmapped lines; drop dishes with zero lines after filter.
2. For each of `sang|trua|chieu`, call `putMenuPeriod({ unitId, date, mealPeriod, note: null, dishes })`.
3. Return `{ menu: await getMenuDay(...), droppedLineCount }`.

- [ ] **Step 1: Write failing tests** for `filterMappedPeriods` (keeps mapped, drops null) and suggest with injected `completeMenuJson` mock (no network).

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement service**

- [ ] **Step 4: Run — expect PASS**

```bash
cd quanluong-app-be && node --test src/modules/kitchen-books/kitchen-books-menu-ai*.test.js
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(kitchen): service AI suggest/apply thực đơn ngày"
```

---

### Task 5: HTTP routes, validation, rate limit

**Files:**
- Modify: `kitchen-books.validator.js`, `kitchen-books.route-definitions.js`, `kitchen-books.controller.js`, `kitchen-books.routes.js`
- Create: `quanluong-app-be/src/middlewares/menu-ai-rate-limit.middleware.js` (mirror `auth-rate-limit.middleware.js` pattern; e.g. 10 req / 15 min / userId+IP)

**Interfaces:**
- Routes:
  - `POST /menu/ai-suggest` → `suggestMenuDayController`
  - `POST /menu/ai-apply` → `applyMenuDayAiController`
- Zod: suggest `{ unitId, date }`; apply `{ unitId, date, periods: { sang/trua/chieu: { dishes: [...] } } }` matching putMenu dish/line shapes plus optional `mapped`/`commodityName` (strip before put).

- [ ] **Step 1: Add route definitions** with `PERMISSIONS.KITCHEN_BOOKS_ACCESS` (same code — no new permission catalog entry required).

- [ ] **Step 2: Wire validators, controllers, routes**; attach rate limit **only** on `ai-suggest`.

- [ ] **Step 3: Restart BE / hit health**; manually `curl` without auth expects 401.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(kitchen): API ai-suggest và ai-apply"
```

---

### Task 6: Frontend dialog + API hooks

**Files:**
- Modify: `packages/shared/src/features/kitchen-books/api/kitchenBooksApi.js`
- Modify: `packages/shared/src/app/query/queryKeys.js` (invalidate menu + menuDetail on apply success)
- Create: `packages/shared/src/pages/kitchen-books/KitchenMenuAiSuggestDialog.jsx`
- Modify: `packages/shared/src/pages/kitchen-books/KitchenMenuTab.jsx`

**Interfaces:**
- `useSuggestKitchenMenuAiMutation()` → `POST /kitchen-books/menu/ai-suggest`
- `useApplyKitchenMenuAiMutation()` → `POST /kitchen-books/menu/ai-apply`
- Dialog props: `{ open, onOpenChange, unitId, date, preview, warnings, onApplied }`
- Button on toolbar near «Lưu buổi»: **AI gợi ý ngày**; disabled when `!selectedUnitId || !menuDate || !canAccess`

**UI behavior:**
1. Click → call suggest → open dialog with periods tables (name, LTTP, định lượng, badge mapped/unmapped).
2. Show `warnings` and count of unmapped lines.
3. Áp dụng → if current period drafts dirty or menu has dishes, `confirm` overwrite → apply → toast with dropped count → invalidate queries → close.
4. Errors: show `notifyError` with server message (incl. missing API key).

- [ ] **Step 1: Add API hooks**

- [ ] **Step 2: Build dialog** (reuse existing Dialog/Button patterns from kitchen books / shadcn).

- [ ] **Step 3: Wire button in `KitchenMenuTab`**

- [ ] **Step 4: Manual smoke** on `http://localhost:8080/so-sach-bep-an` tab Sổ thực đơn (with `MENU_AI_API_KEY` set in BE env). Without key: expect clear error toast.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(kitchen): UI AI gợi ý thực đơn ngày"
```

---

### Task 7: Spec coverage checklist (no code)

- [ ] Confirm every spec row in «Quyết định đã chốt» and API sections maps to Tasks 1–6.
- [ ] Confirm out-of-scope items (chat, week, fine-tune) were not implemented.
- [ ] Note in PR/commit body: set `MENU_AI_API_KEY` in Docker/BE env to enable.

---

## Spec self-review (plan author)

| Spec item | Task |
|-----------|------|
| Global history RAG | T2 + T4 |
| Local LTTP map | T1 + T4 |
| Preview then apply 3 meals | T4 + T6 |
| Only mapped lines on apply | T4 `filterMappedPeriods` |
| Server-side LLM + env | T3 |
| Rate limit suggest | T5 |
| Button on Sổ thực đơn only | T6 |
| Unit tests map/parse | T1–T4 |

No placeholders left in tasks above.
