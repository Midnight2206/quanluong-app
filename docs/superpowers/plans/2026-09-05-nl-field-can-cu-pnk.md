# NL_FIELD_can_cu_pnk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `NL_FIELD_can_cu_pnk` with hardcoded căn cứ text (`Căn cứ vào BKMH số … của đ/c {buyerName}`, join `, `), split reusable `NL_FIELD` vs `FIELD` modules, drop legacy `FIELD_can_cu_bkmh` / `canCuBkmh`.

**Architecture:** BE modules `chung-tu-nl-field.js` + `chung-tu-label-field.js` (+ tiny prefix helper); FE mirrors; document-service imports both prefixes; PNK context key becomes `canCuPnk`.

**Tech Stack:** Node ESM + `node:test`, Python pytest (document-service), React shared package

**Spec:** `docs/superpowers/specs/2026-09-05-nl-field-can-cu-pnk-design.md`

## Global Constraints

- Named Range: only `NL_FIELD_can_cu_pnk` (no legacy `FIELD_can_cu_bkmh` / `canCuBkmh`)
- Key: `canCuPnk`
- Line: `Căn cứ vào BKMH số {so} ngày {dd} tháng {mm} năm {yyyy} của đ/c {buyerName}` (no quotes); missing date omits date clause; empty so/name → `—`
- Multi: dedup then join with `, `
- `NL_FIELD_*` not in Superadmin label form; `FIELD_*` remains labelable
- Split NL vs label modules for reuse
- No new dependencies
- Rebuild document image after Python change

---

## File Map

| File | Role |
|------|------|
| `quanluong-app-be/.../chung-tu-named-range-prefix.js` | `FIELD_` / `NL_FIELD_` + `splitNamedRangePrefix` |
| `quanluong-app-be/.../chung-tu-nl-field.js` (+ test) | NL catalog row, `formatCanCuPnk*`, `resolveNlFieldKey`, `isNlFieldNamedRange` |
| `quanluong-app-be/.../chung-tu-label-field.js` (+ test) | `isLabelFieldNamedRange`, move `formatDerivedNamedRangeValue` here |
| `chung-tu-named-range-display.js` | Re-export format from label-field; drop `cancubkmh` legacy |
| `chung-tu-pdf-field-catalog.js` | Merge NL scalars from nl-field; remove old can_cu_bkmh |
| `chung-tu-pdf-column-alias.util.js` | Strip both prefixes; `can_cu_pnk` → `canCuPnk`; remove `can_cu_bkmh` |
| `chung-tu-data-resolver.service.js` / `chung-tu-pnk-bkmh-basis.service.js` | Use `formatCanCuPnk*`; property `canCuPnk` |
| `chung-tu-category.constants.js` + FE category config | `canCuPnk` |
| `services/document-service/app/import/field_named_ranges.py` | Prefix helpers for importer + static_cells |
| `packages/shared/.../chungTuNlField.js` / `chungTuLabelField.js` | FE prefix helpers; move resolve from scalar key file |
| `SuperadminChungTuPdfCategoryTemplates.jsx` | Skip NL fields in label list |

---

### Task 1: BE prefix + NL format module + label-field shell

**Files:**
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-named-range-prefix.js`
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-nl-field.js`
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-nl-field.test.js`
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-label-field.js`
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-label-field.test.js`
- Modify: `chung-tu-named-range-display.js` (move `formatDerivedNamedRangeValue` body into label-field; re-export for compatibility)

**Interfaces:**
- Produces:
  - `splitNamedRangePrefix(name) → { prefix: 'FIELD_'|'NL_FIELD_'|null, fieldName: string }`
  - `isNlFieldNamedRange(name)`, `isLabelFieldNamedRange(name)`
  - `formatCanCuPnkLine({ soChungTu, periodDate|ngay,thang,nam, buyerName })`
  - `formatCanCuPnkText(rows)`
  - `resolveNlFieldKey(raw) → 'canCuPnk'|''`
  - `NL_FIELD_CATALOG_SCALARS` (frozen array with `NL_FIELD_can_cu_pnk`)
  - `formatDerivedNamedRangeValue` from label-field

- [ ] **Step 1: Failing tests** in `chung-tu-nl-field.test.js`:

```js
test("formatCanCuPnkLine with date and buyerName", () => {
  assert.equal(
    formatCanCuPnkLine({
      soChungTu: "062601",
      periodDate: "2026-06-01",
      buyerName: "Nguyễn Văn A",
    }),
    "Căn cứ vào BKMH số 062601 ngày 01 tháng 06 năm 2026 của đ/c Nguyễn Văn A",
  );
});

test("formatCanCuPnkLine without date", () => {
  assert.equal(
    formatCanCuPnkLine({ soChungTu: "1", buyerName: "A" }),
    "Căn cứ vào BKMH số 1 của đ/c A",
  );
});

test("formatCanCuPnkText joins with comma", () => {
  assert.equal(
    formatCanCuPnkText([
      { soChungTu: "1", periodDate: "2026-06-01", buyerName: "A" },
      { soChungTu: "2", periodDate: "2026-06-02", buyerName: "B" },
    ]),
    "Căn cứ vào BKMH số 1 ngày 01 tháng 06 năm 2026 của đ/c A, Căn cứ vào BKMH số 2 ngày 02 tháng 06 năm 2026 của đ/c B",
  );
});

test("resolveNlFieldKey maps NL_FIELD_can_cu_pnk", () => {
  assert.equal(resolveNlFieldKey("NL_FIELD_can_cu_pnk"), "canCuPnk");
  assert.equal(resolveNlFieldKey("can_cu_pnk"), "canCuPnk");
  assert.equal(resolveNlFieldKey("FIELD_can_cu_bkmh"), "");
});
```

Label-field test: `isLabelFieldNamedRange("FIELD_so") === true`, `isNlFieldNamedRange("NL_FIELD_can_cu_pnk") === true`, and existing `formatDerivedNamedRangeValue` behavior still passes via re-export (keep/update `chung-tu-named-range-display.test.js`).

- [ ] **Step 2: Run — expect FAIL**

```bash
cd quanluong-app-be && node --test src/modules/chung-tu-quyet-toan/chung-tu-nl-field.test.js
```

- [ ] **Step 3: Implement** modules per Interfaces (empty so/buyer → `—`; date from ISO `periodDate` or ngay/thang/nam).

- [ ] **Step 4: Tests PASS** (nl-field + label-field + named-range-display tests).

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-named-range-prefix.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-nl-field.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-nl-field.test.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-label-field.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-label-field.test.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-named-range-display.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-named-range-display.test.js
git commit -m "$(cat <<'EOF'
feat(chung-tu): add NL_FIELD and label-field modules

EOF
)"
```

---

### Task 2: Wire catalog, resolve, PNK context `canCuPnk`

**Files:**
- Modify: `chung-tu-pdf-field-catalog.js` (+ test)
- Modify: `chung-tu-pdf-column-alias.util.js` (+ test) — strip `NL_FIELD_` via prefix helper; remove `can_cu_bkmh`; add `can_cu_pnk` → `canCuPnk` (or delegate NL to `resolveNlFieldKey`)
- Modify: `chung-tu-data-resolver.service.js` — use `formatCanCuPnkText` from slices with `buyerName`; set `canCuPnk`
- Modify: `chung-tu-pnk-bkmh-basis.service.js` — call NL formatters; set `canCuPnk`; remove old exports or re-export wrappers that call new format
- Modify: `chung-tu-category.constants.js`, `chung-tu-template-fill-config.service.js`, related tests
- Modify: `packages/shared/.../chungTuCategoryConfig.js` derived names `canCuPnk`
- Update all tests asserting `canCuBkmh` / old sentence

**Interfaces:**
- Consumes: Task 1 formatters
- Produces: PNK sheetContext.`canCuPnk`; catalog `NL_FIELD_can_cu_pnk`

- [ ] **Step 1: Update failing tests** (catalog namedRange, resolve, pnk-from-bkmh expected string with new sentence + `, ` join + `buyerName`).

- [ ] **Step 2: Run targeted tests — expect FAIL**

```bash
cd quanluong-app-be && node --test \
  src/modules/chung-tu-quyet-toan/chung-tu-pdf-field-catalog.test.js \
  src/modules/chung-tu-quyet-toan/chung-tu-pdf-column-alias.util.test.js \
  src/modules/chung-tu-quyet-toan/chung-tu-pnk-from-bkmh.service.test.js \
  src/modules/chung-tu-quyet-toan/chung-tu-pnk-bkmh-basis.service.test.js
```

- [ ] **Step 3: Implement wiring** — grep `canCuBkmh` / `can_cu_bkmh` / `formatCanCuBkmh` in module and replace.

Ensure `formatCanCuPnkLineFromSlice` uses `slice.buyerName` (and `soChungTu`, `periodDate`).

- [ ] **Step 4: PASS** above tests + any broken by rename.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(chung-tu): switch PNK căn cứ to NL_FIELD_can_cu_pnk

EOF
)"
```

---

### Task 3: Document-service import `NL_FIELD_*`

**Files:**
- Create: `services/document-service/app/import/field_named_ranges.py`
- Modify: `template_importer.py` `_build_fields`
- Modify: `static_cells.py` field coord detection (skip both prefixes)
- Modify: `tests/test_template_importer.py` — add NL_FIELD case
- Modify: `README.md` one line on `NL_FIELD_*`

**Interfaces:**
- Produces: fields with `field_name=can_cu_pnk` from `NL_FIELD_can_cu_pnk`; optional `labelable=False` on FieldMeta if model allows — if FieldMeta has no such field, skip and rely on prefix in FE via named range in catalog only; **prefer** adding `labelable: bool` on FieldMeta if cheap, else document that FE uses catalog/`NL_FIELD_` from raw name if exposed.

Check FieldMeta schema — if only `field_name`, FE Superadmin must know NL via catalog `supportsLabel` **or** document-service returns original named range. Spec locked: exclude when named range starts with `NL_FIELD_`. If fields API only returns `field_name`, Superadmin needs catalog lookup: skip if catalog entry for fieldKey has `supportsLabel: false` **and** namedRange starts with `NL_FIELD_` — OR return `named_range` on field meta.

**Locked for this task:** Add `named_range` (full name) on FieldMeta JSON if not present; FE uses `named_range.startsWith("NL_FIELD_")`.

- [ ] **Step 1: Failing importer test** — workbook with `NL_FIELD_can_cu_pnk` parses; `field_name == can_cu_pnk`; `named_range` or equivalent present.

- [ ] **Step 2: Implement `field_named_ranges.py` + wire importer/static_cells.**

- [ ] **Step 3: pytest PASS** `tests/test_template_importer.py`

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(document-service): import NL_FIELD_* named ranges

EOF
)"
```

---

### Task 4: FE modules + Superadmin skip NL labels

**Files:**
- Create: `packages/shared/src/pages/chungTuQuyetToan/chungTuNlField.js` (+ test)
- Create or rename: `chungTuLabelField.js` — move `resolvePdfScalarFieldKey` from `chungTuPdfScalarFieldKey.js` (keep thin re-export for compat)
- Modify: `SuperadminChungTuPdfCategoryTemplates.jsx` — skip `isNlFieldNamedRange(namedRange)` / skip when fabricated range is NL
- Modify: source tests
- Update FE `can_cu_pnk` → `canCuPnk` in resolve aliases; remove `can_cu_bkmh`

For template fields without full named_range from API yet: if `field_name` resolves via `resolveNlFieldKey` to non-empty, treat as NL (skip labels). Prefer API `named_range` from Task 3.

- [ ] **Step 1: Failing tests** — `isNlFieldNamedRange`; Superadmin source assert skip NL / import chungTuNlField.

- [ ] **Step 2: Implement + PASS**

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(chung-tu): exclude NL_FIELD from Superadmin label form

EOF
)"
```

---

## Spec coverage

| Spec | Task |
|------|------|
| Module split NL vs FIELD | T1, T4 |
| Format + comma join | T1–T2 |
| `canCuPnk` rename / drop legacy | T2 |
| Document-service NL import | T3 |
| Superadmin no NL labels | T4 |
| Catalog NL entry | T2 |

## Ops

```bash
docker compose build document && docker compose up -d document
```

Re-upload PNK Excel with `NL_FIELD_can_cu_pnk`.
