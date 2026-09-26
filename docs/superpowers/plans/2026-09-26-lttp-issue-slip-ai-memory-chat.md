# LTTP Issue Slip AI Memory + Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After AI suggest, let users multi-turn chat to fix the preview; persist unit-scoped memory on Apply + Save; inject ~20 memories and recipient-unit issue-slip habits from production DB into each suggest.

**Architecture:** Extend existing `lttp-issue-slip-ai.*` pipeline. New Prisma `LttpIssueSlipAiMemory` keyed by `sessionId` + `unitId`. `ai-suggest` opens a session row, returns `sessionId`, and injects memory + recipient-filtered history. `ai-chat` appends turns and re-enriches preview. `ai-memory/commit` stores `finalPreview` on Apply; `ai-memory/link` sets `issueSlipId` after create. Hard TGSX post-process drops `tgsx` lines unless prompt/turns signal TGSX.

**Tech Stack:** Express + Prisma, existing `completeMenuJson` / enrich / rate-limit, React Query mutations, `node:test` + FE `*.selfcheck.mjs`.

**Spec:** `docs/superpowers/specs/2026-09-26-lttp-issue-slip-ai-memory-chat-design.md`

## Global Constraints

- Approach **1** — session chat + `LttpIssueSlipAiMemory` by storage `unitId` + few-shot habits by `recipientUnitId`.
- Inject **~20** memories (prefer `issueSlipId != null`); history **15–20** slips; max **20** chat turns/session.
- No fine-tune / Qdrant / dump toàn bộ DB vào prompt.
- Post-process: default **market-only**; keep `tgsx` only when TGSX signal in prompt/turns.
- Permission: reuse `lttp.issue-slips.write` (same as create / ai-suggest).
- Create mode only; Apply still FE-only (no auto-POST phiếu).
- Prefer BE `*.test.js` and FE `*.selfcheck.mjs`; no new frameworks.
- Do not commit unless the user asks.
- Follow `permission-vi-catalog` when adding route definitions (even if permission code reused).

## File map

| Path | Responsibility |
|------|----------------|
| `quanluong-app-be/prisma/schema.prisma` + migration | `LttpIssueSlipAiMemory` |
| `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-tgsx.js` | Detect TGSX signal + drop tgsx lines |
| `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-memory.js` | Format/load memories; commit/link helpers |
| `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.prompt.js` | Inject memoryText + habit/history into prompt; chat prompt |
| `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.service.js` | suggest(+session), chat, commit, link; recipient history |
| `quanluong-app-be/src/middlewares/lttp-issue-slip-ai-rate-limit.middleware.js` | Rate-limit chat (+ reuse suggest limiter) |
| `lttp.validator.js` / `controller` / `routes` / `route-definitions` | New endpoints |
| `packages/shared/.../lttpApi.js` | Mutations |
| `LttpIssueSlipAiSuggestDialog.jsx` | Chat UI + commit on Apply |
| `LttpPhieuXuatTab.jsx` | `aiSessionId` state + link after create |

---

### Task 1: Prisma `LttpIssueSlipAiMemory`

**Files:**
- Modify: `quanluong-app-be/prisma/schema.prisma`
- Create: `quanluong-app-be/prisma/migrations/20260926120000_lttp_issue_slip_ai_memory/migration.sql`
- Update relations on `Unit`, `User`, `LttpIssueSlip`

**Interfaces:**
- Produces: Prisma model `LttpIssueSlipAiMemory` with fields below

- [ ] **Step 1: Add model** (place near other LTTP models after `LttpIssueSlip`):

```prisma
model LttpIssueSlipAiMemory {
  id            Int       @id @default(autoincrement())
  unitId        Int
  sessionId     String    @unique @db.Uuid
  prompt        String    @db.VarChar(2000)
  turns         Json      // [{ role, text, at }]
  finalPreview  Json?
  issueSlipId   Int?
  createdById   Int
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  unit       Unit          @relation("LttpIssueSlipAiMemoryUnit", fields: [unitId], references: [id], onDelete: Cascade)
  createdBy  User          @relation("LttpIssueSlipAiMemoryCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  issueSlip  LttpIssueSlip? @relation(fields: [issueSlipId], references: [id], onDelete: SetNull)

  @@index([unitId, updatedAt])
  @@index([issueSlipId])
}
```

Add reverse relations on `Unit`, `User`, and optional `LttpIssueSlip.aiMemories LttpIssueSlipAiMemory[]`.

- [ ] **Step 2: Migration SQL** creating table + indexes + FKs matching schema.

- [ ] **Step 3: Generate client** — `cd quanluong-app-be && npx prisma generate` — expect success.

- [ ] **Step 4: Commit (only if user asked)** — `feat(lttp): prisma LttpIssueSlipAiMemory`

---

### Task 2: TGSX post-process helper

**Files:**
- Create: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-tgsx.js`
- Create: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-tgsx.test.js`

**Interfaces:**
- Produces:
  - `hasTgsxSignal(texts: string[]): boolean`
  - `dropTgsxUnlessSignaled({ lines, signalTexts, warnings? }) → { lines, warnings }`

- [ ] **Step 1: Failing tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { hasTgsxSignal, dropTgsxUnlessSignaled } from "./lttp-issue-slip-ai-tgsx.js";

test("hasTgsxSignal detects keywords", () => {
  assert.equal(hasTgsxSignal(["mua TT 10kg gao"]), false);
  assert.equal(hasTgsxSignal(["lay TGSX ga"]), true);
  assert.equal(hasTgsxSignal(["gia san xuat"]), true);
});

test("dropTgsxUnlessSignaled removes tgsx when no signal", () => {
  const { lines, warnings } = dropTgsxUnlessSignaled({
    lines: [
      { commodityName: "A", priceKind: "market" },
      { commodityName: "A", priceKind: "tgsx" },
    ],
    signalTexts: ["xuat mua TT"],
    warnings: [],
  });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].priceKind, "market");
  assert.ok(warnings.some((w) => /tgsx/i.test(w)));
});

test("dropTgsxUnlessSignaled keeps tgsx when signaled", () => {
  const { lines } = dropTgsxUnlessSignaled({
    lines: [
      { commodityName: "A", priceKind: "market" },
      { commodityName: "A", priceKind: "tgsx" },
    ],
    signalTexts: ["can TGSX"],
    warnings: [],
  });
  assert.equal(lines.length, 2);
});
```

- [ ] **Step 2: Run** `node --test quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-tgsx.test.js` — expect FAIL (module missing)

- [ ] **Step 3: Implement** — normalize text (lowercase, strip diacritics optional); match `\btgsx\b`, `tg sx`, `tieu chuan`/`tiêu chuẩn` (if diacritics kept), `gia san xuat` / `giá sản xuất`. If no signal, filter `priceKind === 'tgsx'` and push one short warning: `Đã bỏ dòng TGSX vì mô tả không nêu TGSX`.

- [ ] **Step 4: Re-run — PASS**

- [ ] **Step 5: Commit (only if user asked)**

---

### Task 3: Memory format + recipient history + prompt inject

**Files:**
- Create: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-memory.js`
- Create: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai-memory.test.js`
- Modify: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.prompt.js`
- Create/extend: prompt tests in `lttp-issue-slip-ai.prompt.test.js` (create if missing)
- Modify: `loadHistorySamples` in `lttp-issue-slip-ai.service.js` (or move to shared helper used by service)

**Interfaces:**
- Produces:
  - `formatMemoriesForPrompt(rows, { max = 20 }) → string`
  - `buildIssueSlipAiPrompt({ ..., memoryText, historyText, context })` — includes sections `Bai hoc AI gan day:` + `Mau phieu...`
  - `buildIssueSlipAiChatPrompt({ message, currentPreview, turns, catalogText, memoryText? })`
  - `loadHistorySamples(storageUnitId, { recipientUnitId?, limit = 20 })` — when `recipientUnitId` set, `where: { unitId, recipientUnitId }`

- [ ] **Step 1: Failing tests**
  - `formatMemoriesForPrompt` prefers rows with `issueSlipId`, caps at 20, includes prompt + mapped line names.
  - `buildIssueSlipAiPrompt` user string contains `Bai hoc AI gan day` when `memoryText` non-empty.
  - `loadHistorySamples` (inject prisma mock or export where-builder): with recipient → where includes `recipientUnitId`.

- [ ] **Step 2: Run tests — FAIL**

- [ ] **Step 3: Implement**
  - Memory format example line: `- prompt: "..." | lines: Gao x50 (market); ... | turns: user: doi mat hang1...`
  - Truncate each prompt/turn text (e.g. 200/120 chars).
  - Order: `orderBy: [{ issueSlipId: 'desc' }, { updatedAt: 'desc' }]` then take 20 — or fetch 40 and sort in JS putting non-null `issueSlipId` first (*ponytail:* JS sort OK).
  - Update `loadHistorySamples(storageUnitId, recipientUnitId, limit)` signature; select also `recipientUnitId` optional for debug only.
  - Chat prompt: system same schema; user = catalog (short) + optional memory + currentPreview JSON + turns + new message.

- [ ] **Step 4: Re-run — PASS**

- [ ] **Step 5: Commit (only if user asked)**

---

### Task 4: BE service — suggest session, chat, commit, link + HTTP

**Files:**
- Modify: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.service.js`
- Modify: `quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai.service.test.js`
- Modify: `lttp.validator.js`, `lttp.controller.js`, `lttp.routes.js`, `lttp.route-definitions.js`
- Modify: `lttp-issue-slip-ai-rate-limit.middleware.js` — export chat limiter (same max/window, key `lttp-issue-ai-chat:...`)
- Update VI catalog descriptions for new route keys if required by skill (same `ISSUE_SLIPS_WRITE` code)

**Interfaces:**
- Consumes: Tasks 1–3, existing enrich + `scopeSanitizeIssueSlipAiHeaderDraft` + `completeMenuJson`
- Produces:
  - `suggestIssueSlipAi(...) → { ..., sessionId }`
  - `chatIssueSlipAi({ sessionId, unitId, message, currentPreview? }, ...) → { headerDraft, lines, warnings, sessionId, meta }`
  - `commitIssueSlipAiMemory({ sessionId, unitId, finalPreview, userId })`
  - `linkIssueSlipAiMemory({ sessionId, unitId, issueSlipId, userId })`
  - Routes:
    - `POST /api/lttp/issue-slips/ai-suggest` (existing, extended)
    - `POST /api/lttp/issue-slips/ai-chat`
    - `POST /api/lttp/issue-slips/ai-memory/commit`
    - `POST /api/lttp/issue-slips/ai-memory/link`

- [ ] **Step 1: Failing service tests** (deps injected):
  - suggest creates memory row (`finalPreview: null`, `turns: []`) and returns `sessionId`.
  - suggest calls history with `recipientUnitId` when provided.
  - after enrich, TGSX drop applied using prompt as signal text.
  - chat appends user+assistant turns, rejects when turns length ≥ 20.
  - commit sets `finalPreview`.
  - link sets `issueSlipId` when session belongs to unit.

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement suggest changes**
  1. `assertMenuAiConfigured` + write access (existing).
  2. `sessionId = randomUUID()`.
  3. `prisma.lttpIssueSlipAiMemory.create({ unitId, sessionId, prompt, turns: [], finalPreview: null, createdById })`.
  4. Load catalog; load memories (~20); `loadHistorySamples(unitId, recipientUnitId)`.
  5. `buildIssueSlipAiPrompt` with `memoryText` + `historyText`.
  6. LLM → enrich → `dropTgsxUnlessSignaled({ signalTexts: [prompt] })` → scope header.
  7. Return preview + `sessionId` (+ meta: `historySampleCount`, `memorySampleCount`, `model`).

- [ ] **Step 4: Implement chat**
  - Load memory by `sessionId` + assert `unitId` match + write access.
  - Cap: if `(turns?.length || 0) >= 20` → 400 clear message.
  - Build chat prompt; LLM; enrich; TGSX using `[prompt, ...turns.text, message]`.
  - Append `{ role:'user', text:message, at }` + `{ role:'assistant', text: short summary or JSON.stringify lines names, at }` — *ponytail:* assistant turn text = first 500 chars of `JSON.stringify({ headerDraft, lines: mapped names })`.
  - `prisma.update` turns; return new preview + `sessionId`.

- [ ] **Step 5: Implement commit + link**
  - commit: require session; set `finalPreview` (JSON); touch `updatedAt`.
  - link: require session + `issueSlipId`; verify slip `unitId` matches memory `unitId`; set FK.

- [ ] **Step 6: Validators**

```js
aiChatIssueSlipBodySchema = z.object({
  sessionId: z.string().uuid(),
  unitId: z.coerce.number().int().positive(),
  message: z.string().trim().min(1).max(2000),
  currentPreview: z.record(z.any()).optional(),
});
aiMemoryCommitBodySchema = z.object({
  sessionId: z.string().uuid(),
  unitId: z.coerce.number().int().positive(),
  finalPreview: z.record(z.any()),
});
aiMemoryLinkBodySchema = z.object({
  sessionId: z.string().uuid(),
  unitId: z.coerce.number().int().positive(),
  issueSlipId: z.coerce.number().int().positive(),
});
```

- [ ] **Step 7: Routes** — register **before** `/:id`; rate-limit suggest + chat; commit/link can share chat limiter or lighter same limiter. Route definition keys: `aiChatIssueSlip`, `aiMemoryCommitIssueSlip`, `aiMemoryLinkIssueSlip`. Permission code `LTTP_PERMISSIONS.ISSUE_SLIPS_WRITE`. Update `permission-catalog.vi.js` entries for new codes **only if** new permission codes are introduced — if reusing write code, still add distinct route definition `name`/`description` VI via catalog sync path used by existing ai-suggest (follow how `aiSuggestIssueSlip` is catalogued).

- [ ] **Step 8: Run all related BE tests — PASS**

```bash
node --test quanluong-app-be/src/modules/lttp/lttp-issue-slip-ai*.test.js
```

- [ ] **Step 9: Commit (only if user asked)** — `feat(lttp): AI issue-slip session chat + memory APIs`

---

### Task 5: FE API mutations

**Files:**
- Modify: `packages/shared/src/features/lttp/api/lttpApi.js`

**Interfaces:**
- Produces:
  - `useSuggestLttpIssueSlipAiMutation` — response may include `sessionId` (no break)
  - `useChatLttpIssueSlipAiMutation()` → `POST /lttp/issue-slips/ai-chat`
  - `useCommitLttpIssueSlipAiMemoryMutation()` → `POST /lttp/issue-slips/ai-memory/commit`
  - `useLinkLttpIssueSlipAiMemoryMutation()` → `POST /lttp/issue-slips/ai-memory/link`

- [ ] **Step 1: Add mutations** mirroring suggest pattern (`unitId` in body, same base path).

- [ ] **Step 2: Selfcheck or smoke import** — quick node assert file exports four hooks (optional tiny `lttpIssueSlipAi.api.selfcheck.mjs` grepping source).

- [ ] **Step 3: Commit (only if user asked)**

---

### Task 6: FE dialog chat + commit on Apply

**Files:**
- Modify: `packages/shared/src/pages/lttpNhapXuat/LttpIssueSlipAiSuggestDialog.jsx`
- Modify: `packages/shared/src/pages/lttpNhapXuat/LttpIssueSlipAiSuggestDialog.contract.selfcheck.mjs`

**Interfaces:**
- Consumes: suggest/chat/commit mutations
- Produces: `onApply(preview, { sessionId })` (extend callback; tab must accept 2nd arg)
- Props unchanged except Apply semantics

- [ ] **Step 1: Update selfcheck** to require strings: `ai-chat` or `Chat`/`chat`, `ai-memory/commit` or `commit`, `sessionId`.

- [ ] **Step 2: Run selfcheck — FAIL**

- [ ] **Step 3: Implement UI**
  - State: `sessionId`, `preview`, `prompt`, `chatMessage`, `turns` (optional display from local append).
  - On suggest success: set `preview` + `sessionId` from response.
  - After preview: show chat input + Send → `ai-chat` with `{ sessionId, unitId, message, currentPreview: preview }` → replace `preview`.
  - Apply: `await commit({ sessionId, unitId, finalPreview: preview })` then `onApply(preview, { sessionId })`; on commit fail → `notifyError`, do not apply.
  - Reset all on close.

- [ ] **Step 4: Selfcheck PASS**

- [ ] **Step 5: Commit (only if user asked)**

---

### Task 7: Wire `aiSessionId` on tab + link after save

**Files:**
- Modify: `packages/shared/src/pages/lttpNhapXuat/LttpPhieuXuatTab.jsx`
- Modify/create: small contract selfcheck if one exists for tab AI wiring; else extend dialog selfcheck only and manual assert in tab via grep selfcheck file `LttpPhieuXuatTab.ai-memory.contract.selfcheck.mjs`

**Interfaces:**
- Consumes: `onApply(preview, { sessionId })`, `useLinkLttpIssueSlipAiMemoryMutation`, create mutation result `id`

- [ ] **Step 1: State** `aiSessionId` (null default); clear on reset/new form / unit change (same places draft reset).

- [ ] **Step 2: `handleApplyIssueSlipAiPreview(preview, meta)` — existing merge + `setAiSessionId(meta?.sessionId ?? null)`.

- [ ] **Step 3: After successful create** (online path where new slip `id` known): if `aiSessionId`, call link `{ sessionId: aiSessionId, unitId: selectedUnitId, issueSlipId: id }`; catch → `notifyError` nhẹ / ignore; then `setAiSessionId(null)`.
  - Offline/outbox: when create flushes and local handler receives server id — hook the same link call if that path already surfaces created id; if outbox create ack is hard to reach, *ponytail:* link online-only in v1 and document in comment `ponytail: offline link deferred`.

- [ ] **Step 4: Selfcheck** asserts tab source contains `aiSessionId`, `ai-memory/link` or `useLinkLttpIssueSlipAiMemoryMutation`, and `onApply` / apply handler passes session.

- [ ] **Step 5: Manual smoke checklist** (no commit needed):
  1. Suggest → sessionId in response.
  2. Chat edits line name → preview updates.
  3. Apply → memory row has `finalPreview`.
  4. Save → `issueSlipId` set.
  5. Next suggest with same recipient → history filtered; memories appear in prompt (log/dev).
  6. Prompt without TGSX → no dual tgsx lines.

- [ ] **Step 6: Commit (only if user asked)** — `feat(lttp): wire AI memory chat on phieu xuat tab`

---

## Spec coverage check

| Spec item | Task |
|-----------|------|
| Model + migrate | 1 |
| TGSX post-process | 2 |
| ~20 memory inject | 3, 4 |
| Recipient habit few-shot | 3, 4 |
| ai-suggest + sessionId | 4 |
| ai-chat | 4, 6 |
| ai-memory/commit on Apply | 4, 6 |
| link issueSlipId on Save | 4, 7 |
| Rate-limit chat | 4 |
| Max 20 turns | 4 |
| FE dialog chat | 6 |
| Create mode only (unchanged) | 7 (no edit button) |

## Out of scope (do not implement)

- Aggregate top-K habit table (optional later)
- GC orphan memory / TTL
- Qdrant / fine-tune / voice / edit-mode suggest
