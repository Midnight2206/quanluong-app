# Chung-tu header settings + FIELD merge geometry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users set đơn vị cấp trên / đơn vị on personal Profile and BKMH-only người mua / bộ phận settings; fix FIELD_* box geometry when the cell sits in an Excel merge so centered text (e.g. `ngay_thang_nam`) aligns under the title.

**Architecture:** Document-service expands FIELD_* width/height to the enclosing merge at import. Node adds `Profile.donViCapTren`/`donVi`, a `ChungTuBkmhHeaderSettings` row for `bang-ke-mua-hang`, and wires the PDF export resolver so slips/snapshots win for người mua while profile/BKMH settings fill Named Range values. FE: Profile form + BKMH header section beside signature settings.

**Tech Stack:** Prisma/MariaDB, Express Node BE, React shared pages, document-service Python import/render, existing `FIELD_*` + `draw_static_cell` path.

## Global Constraints

- Values only; Excel labels/fonts/positions unchanged.
- Profile owns `donViCapTren` + `donVi` (per user).
- BKMH header settings only for `categoryKey = bang-ke-mua-hang`: `hoTenNguoiMua`, `boPhan`.
- Người mua: slip/snapshot non-empty wins; else BKMH settings.
- Named Ranges required: `FIELD_don_vi_cap_tren`, `FIELD_don_vi`, `FIELD_ho_ten_nguoi_mua` (alias `FIELD_nguoi_mua` → same key), `FIELD_bo_phan`, `FIELD_ngay_thang_nam`.
- No static-cell override without Named Range.
- Other categories out of scope.
- PDF path does not use `ChungTuUnitProfile` for the two đơn vị lines.
- Re-import template after Excel Named Range changes; rebuild `document` Docker image after DS changes.

---

## File map

| File | Responsibility |
|------|----------------|
| `services/document-service/app/import/excel_coords.py` (or importer helper) | Resolve enclosing merge bounds → width/height |
| `services/document-service/app/import/template_importer.py` | `_build_fields` uses merge geometry |
| `services/document-service/tests/test_template_importer.py` | Merge field geometry test |
| `quanluong-app-be/prisma/schema.prisma` | Profile fields + `ChungTuBkmhHeaderSettings` |
| Prisma migration | Apply schema |
| `auth.validator.js` / auth mapper / profile patch | Accept/return new profile fields |
| `packages/shared/.../ProfilePage.jsx` + `authSchemas.js` | UI + zod |
| `chung-tu-bkmh-header-settings.service.js` (+ routes/controller/validator/permissions) | GET/PUT BKMH header |
| `chungTuPdfApi.js` + signature workspace (or sibling UI) | FE hooks + form |
| `chung-tu-pdf-field-catalog.js` | `ho_ten_nguoi_mua` |
| `chung-tu-data-resolver.service.js` (+ tests) | Wire profile + BKMH fallback |
| `chung-tu-pdf-column-alias.util.js` | Alias `nguoi_mua` → `hoTenNguoiMua` if needed |

---

### Task 1: FIELD_* enclosing-merge geometry (document-service)

**Files:**
- Modify: `services/document-service/app/import/excel_coords.py` (add helper) and/or `template_importer.py` `_build_fields`
- Test: `services/document-service/tests/test_template_importer.py` (or new `test_field_merge_geometry.py`)

**Interfaces:**
- Produces: `enclosing_merge_bounds(sheet, row, col) -> (min_col, min_row, max_col, max_row) | None`
- `_build_fields`: if enclosing merge exists, `width_pt`/`height_pt`/`x`/`y` from full merge (top-left of merge); else keep single-cell behavior.

- [ ] **Step 1: Failing test** — workbook with merged B2:D2, Named Range `FIELD_ngay_thang_nam` on `$B$2`, center align; assert parsed field `width_pt` equals sum of cols B–D (not just B), and `x` is left of B.

- [ ] **Step 2: Run — expect FAIL**

```bash
cd services/document-service && ./.venv/bin/pytest tests/test_template_importer.py -k merge -v
```

- [ ] **Step 3: Implement** — find merge containing `(row,col)`; use `cell_top_left_pt` on merge min; `merged_range_width_pt`; height = sum of row heights in merge (or single row height × span). Still reject Named Ranges that span multiple cells **as the defined name destination** if current validator requires single cell — but allow single-cell name that sits **inside** a larger merge.

- [ ] **Step 4: PASS + Commit**

```bash
git commit -m "fix(document): use Excel merge box for FIELD_* geometry"
```

---

### Task 2: Profile.donViCapTren + Profile.donVi

**Files:**
- Modify: `quanluong-app-be/prisma/schema.prisma` (`Profile`)
- Create: Prisma migration
- Modify: `auth.validator.js` `meProfilePatchSchema`
- Modify: auth profile patch handler / mapper (`auth.mapper.js`, profile update service)
- Modify: `packages/shared/src/features/auth/schemas/authSchemas.js`
- Modify: `packages/shared/src/pages/profile/ProfilePage.jsx`
- Test: existing auth profile tests or small node:test for validator

**Interfaces:**
- Produces: Profile columns `donViCapTren String?`, `donVi String?` (@db.VarChar(255))
- `PATCH /auth/me/profile` body may include both; `/auth/me` returns them on profile.

- [ ] **Step 1: Schema + migration** — add columns; `npx prisma migrate dev` (or create SQL migration matching repo style).

- [ ] **Step 2: Validator + mapper tests** — patch accepts `donViCapTren`/`donVi`; response includes them.

- [ ] **Step 3: ProfilePage** — two inputs labeled e.g. “Đơn vị cấp trên”, “Đơn vị”; wire to form schema + mutation.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(auth): profile donViCapTren and donVi for chứng từ header"
```

---

### Task 3: ChungTuBkmhHeaderSettings API

**Files:**
- Modify: `schema.prisma` — model `ChungTuBkmhHeaderSettings`
- Migration
- Create: `chung-tu-bkmh-header-settings.service.js`
- Modify: validator, controller, routes, `chung-tu-quyet-toan.route-definitions.js`
- Permission: same codes as signature settings (`LTTP_ISSUE_SLIPS_READ` / `WRITE`)
- Update permission VI catalog via skill `permission-vi-catalog` when adding routes
- Test: service test (get empty → null/defaults; put upsert; reject non-BKMH category)

**Interfaces:**
- Model: `id`, `categoryKey` unique (must be `bang-ke-mua-hang`), `hoTenNguoiMua String?`, `boPhan String?`, `updatedById`, timestamps
- `GET /api/chungtuquyettoan/bkmh-header-settings?categoryKey=bang-ke-mua-hang`
- `PUT` body: `{ categoryKey, hoTenNguoiMua?, boPhan? }` — assert category is BKMH only (`assertKnownCategoryKey` + equality check)

- [ ] **Step 1: Failing service test** for upsert/get

- [ ] **Step 2: Implement model + service + HTTP**

- [ ] **Step 3: Permission catalog VI entries** for new route keys

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(chung-tu): BKMH header settings API for người mua/bộ phận"
```

---

### Task 4: Resolver + catalog + PDF field mapping

**Files:**
- Modify: `chung-tu-data-resolver.service.js` (+ unit tests)
- Modify: `chung-tu-pdf-field-catalog.js` — add `FIELD_ho_ten_nguoi_mua` / `hoTenNguoiMua`
- Modify: `chung-tu-pdf-column-alias.util.js` — `nguoi_mua` / `ho_ten_nguoi_mua` → `hoTenNguoiMua`; ensure `don_vi` maps to profile `donVi`
- Modify: export path that builds context — pass **exporting user** profile (not unit profile) for đơn vị lines; load BKMH header settings when category is BKMH

**Resolver rules (exact):**

```
donViCapTren / don_vi_cap_tren ← user.profile.donViCapTren ?? ""
donVi / don_vi / donViSo ← user.profile.donVi ?? ""   // keep donViSo alias for older templates
hoTenNguoiMua / ho_ten_nguoi_mua ← slipOrSnapshot if non-empty else bkmhHeader.hoTenNguoiMua ?? ""
boPhan / bo_phan ← existing non-empty slip/doc value else bkmhHeader.boPhan ?? ""
```

Do **not** prefer `ChungTuUnitProfile.donViCapTren` for PDF document-service fields.

- [ ] **Step 1: Failing resolver tests** — profile wins for đơn vị; slip wins người mua; empty slip → settings

- [ ] **Step 2: Implement + catalog**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(chung-tu): resolve header fields from profile and BKMH settings"
```

---

### Task 5: FE BKMH header settings UI

**Files:**
- Modify: `packages/shared/src/features/chung-tu-quyet-toan/api/chungTuPdfApi.js` — query/mutation hooks
- Modify: `packages/shared/src/app/query/queryKeys.js`
- Modify: `ChungTuSignatureSettingsWorkspace.jsx` **or** small sibling section rendered only when `categoryKey === "bang-ke-mua-hang"` — two inputs: Họ tên người mua, Bộ phận; save via PUT

- [ ] **Step 1: Hooks** mirroring signature-settings pattern

- [ ] **Step 2: UI** — show only for BKMH; load defaults; save; toast success/error

- [ ] **Step 3: Smoke manually** — optional; at least ensure no console errors in unit tests if any

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(chung-tu): BKMH header settings form beside signature settings"
```

---

### Task 6: Rebuild document + operator notes

**Files:** none required (ops)

- [ ] **Step 1: Rebuild document image**

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file quanluong-app-be/.env.docker up -d --build document
```

- [ ] **Step 2: Apply Prisma migrate** on app container if needed

- [ ] **Step 3: Checklist for operator** (leave in PR/commit message or short note in progress ledger, not a new markdown doc unless asked):
  1. Excel: add Named Ranges; clear hard-coded values in value cells; keep label cells static
  2. Superadmin: re-import + publish template
  3. User: fill Profile đơn vị; fill BKMH header settings
  4. Export PDF: verify center date + header values

- [ ] **Step 4: Commit only if code leftovers**; otherwise stop

---

## Plan self-review

| Spec item | Task |
|-----------|------|
| Merge geometry for FIELD_* | 1 |
| Profile đơn vị | 2 |
| BKMH settings API | 3 |
| Resolver priority | 4 |
| Catalog ho_ten_nguoi_mua | 4 |
| FE settings UI | 5 |
| Re-import / rebuild | 6 |
| No other categories / no static override | — out of scope |

No TBD placeholders.
