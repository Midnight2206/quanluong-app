# LTTP phiếu xuất signature fields + ordering capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Map LTTP phiếu xuất PDF fields from slip/writer/recipient/unit signature settings; add per-unit signature settings UI like CTQT; fix Đặt hàng mobile full-table capture.

**Architecture:** New `LttpIssueSlipSignatureSettings` keyed by storage `unitId` (signatureBlock + extraFields). Slip gains `receivedDate` + `signerStorekeeper`. Print loads settings by `slip.unitId`, builds context/signatures, passes `signatureBlock` into existing document-service payload. FE adds a Nhập xuất tab cloning CTQT signature workspace patterns. Ordering capture always unhides the matrix before `html-to-image`.

**Tech Stack:** Prisma/MySQL, Express LTTP module, React shared package, document-service PDF, CTQT signature block JSON shape.

**Spec:** `docs/superpowers/specs/2026-09-21-lttp-phieu-xuat-signature-fields-design.md`

## Global Constraints

- Signature settings scope = storage unit (`unitId`), not CTQT global category.
- PDF `nhanTaiKho` / `lyDoSuDung` from unit settings extraFields only.
- `NL_FIELD_don_vi*` from exporting user profile only.
- `boPhan` from recipient `profile.department`.
- History + ordering business logic unchanged; ordering only capture fix.
- Do not commit unless user asks.

## File map

| File | Responsibility |
|------|----------------|
| `quanluong-app-be/prisma/schema.prisma` | Model + slip columns |
| `quanluong-app-be/prisma/migrations/*` | Migration |
| `quanluong-app-be/src/modules/lttp/lttp-issue-slip-signature-settings.service.js` | GET/upsert settings |
| `quanluong-app-be/src/modules/lttp/lttp-issue-slip-signature-defaults.js` | Default 4-slot block |
| `quanluong-app-be/src/modules/lttp/lttp-issue-slip-document.service.js` | PDF context + signatures + block |
| `quanluong-app-be/src/modules/lttp/lttp.service.js` | Slip CRUD fields; recipient list department |
| `quanluong-app-be/src/modules/lttp/lttp.validator.js` / routes / controller / route-definitions | API wiring |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-field-catalog.js` (+ alias util) | New scalar fields/aliases |
| `packages/shared/.../LttpSignatureSettingsTab.jsx` | Unit signature UI |
| `packages/shared/.../LttpNhapXuatPage.jsx` | New tab |
| `packages/shared/.../LttpPhieuXuatTab.jsx` | receivedDate + 4 signers |
| `packages/shared/.../lttpApi` (or existing LTTP hooks) | Settings query/mutation |
| `packages/shared/.../LttpOrderingTab.jsx` | Capture force-show fix |

---

### Task 1: Prisma model + slip columns

**Files:**
- Modify: `quanluong-app-be/prisma/schema.prisma`
- Create: migration SQL under `quanluong-app-be/prisma/migrations/`

**Produces:** `LttpIssueSlipSignatureSettings`; `LttpIssueSlip.receivedDate`, `signerStorekeeper`

- [ ] **Step 1:** Add model + Unit relation; add slip fields
- [ ] **Step 2:** Create migration (nullable columns; unique `unitId`)
- [ ] **Step 3:** `npx prisma generate` in be package
- [ ] **Step 4:** Source/assert migration exists; skip commit

---

### Task 2: Default block + settings service + API

**Files:**
- Create: `lttp-issue-slip-signature-defaults.js`
- Create: `lttp-issue-slip-signature-settings.service.js` (+ `.test.js`)
- Modify: `lttp.validator.js`, `lttp.controller.js`, `lttp.routes.js`, `lttp.route-definitions.js`

**Produces:**
- `getDefaultLttpIssueSlipSignatureBlock()` → 4 slots
- `getLttpIssueSlipSignatureSettings({ unitId })`
- `upsertLttpIssueSlipSignatureSettings({ unitId, signatureBlock, extraFields, updatedById })`

- [ ] **Step 1:** Failing test — empty GET returns default 4 keys `nguoi_viet_phieu|thu_kho|nguoi_nhan|nguoi_duyet` and empty extraFields
- [ ] **Step 2:** Implement defaults + service (mirror CTQT upsert shape; scope unit via existing LTTP storage asserts)
- [ ] **Step 3:** Wire GET/PUT routes + permissions (same as form-defaults / issue slip write)
- [ ] **Step 4:** Run `node --test …signature-settings*.test.js` — pass

---

### Task 3: Catalog aliases + PDF context/signatures

**Files:**
- Modify: `chung-tu-pdf-field-catalog.js`, `chung-tu-pdf-column-alias.util.js`, category extras if needed
- Modify: `lttp-issue-slip-document.service.js` (+ test)
- Modify: `lttp.service.js` — include recipient profile.department on getIssueSlipById; listRecipientUsers return department
- Modify: slip create/update validators + service for `receivedDate`, `signerStorekeeper`

**Produces:** Context keys `boPhan`, `lyDoSuDung`, `ngayGiao`, `ngayNhan`, `nhanTaiKho` (from settings), `donVi*` from writer profile; `signatureBlock` + merged `signatures` in PDF buffer builder

- [ ] **Step 1:** Failing tests for field map + signature merge priority (slip override > static settings)
- [ ] **Step 2:** Implement context builder changes; load settings by `slip.unitId` inside `buildIssueSlipDocumentPdfBuffer`
- [ ] **Step 3:** Pass `signatureBlock` into `buildDocumentServicePayload`
- [ ] **Step 4:** Run document + alias + catalog tests — pass

---

### Task 4: FE API + signature settings tab

**Files:**
- Modify: LTTP feature API hooks (find existing `features/lttp` or shared api module)
- Create: `LttpSignatureSettingsTab.jsx` (clone patterns from `ChungTuSignatureSettingsWorkspace.jsx` — extraFields lyDoSuDung/nhanTaiKho; default 4 slots)
- Modify: `LttpNhapXuatPage.jsx` — tab «Cài đặt chữ ký»
- Test: source assert tab + API paths

- [ ] **Step 1:** Hooks GET/PUT signature-settings
- [ ] **Step 2:** Tab UI wired to `effectiveUnitId`
- [ ] **Step 3:** Mount tab; source test
- [ ] **Step 4:** Run FE source tests — pass

---

### Task 5: Form phiếu — receivedDate + 4 signers

**Files:**
- Modify: `LttpPhieuXuatTab.jsx`
- Modify: draft persist / create-update payload

- [ ] **Step 1:** Add `receivedDate` input; sync with `issueDate` when appropriate
- [ ] **Step 2:** Add `signerStorekeeper`; seed 4 signers from unit settings on create
- [ ] **Step 3:** Include new fields in save payload + edit prefill
- [ ] **Step 4:** Source assert `receivedDate` / `signerStorekeeper` present

---

### Task 6: Fix Đặt hàng mobile capture

**Files:**
- Modify: `LttpOrderingTab.jsx`
- Modify: capture helper if needed
- Test: source assert `forceShowTableForCapture` before capture on mobile path

- [ ] **Step 1:** Ensure every capture path sets force-show + awaits layout before `toBlob`
- [ ] **Step 2:** Prefer capturing `#lttp-daily-order-print` after unhide (or equivalent full root)
- [ ] **Step 3:** Source test — no capture while table still `hidden` without force flag
- [ ] **Step 4:** Run ordering-related source tests — pass

---

### Task 7: Smoke checklist

- [ ] BE: settings + document context tests green
- [ ] FE: nhap xuat / pdf path / ordering capture asserts green
- [ ] Manual (if docker up): publish template → create slip → print PDF; mobile ordering «Xem bảng»/PNG shows full matrix
- [ ] Do not commit unless user requests
