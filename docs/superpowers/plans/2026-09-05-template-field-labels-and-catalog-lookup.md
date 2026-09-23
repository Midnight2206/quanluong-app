# Template Field Labels + Scalar Catalog Lookup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-template-version field labels (Superadmin); PDF cells = label+value or raw value; scalar catalog lookup as searchable table.

**Architecture:** Add `fieldLabelsJson` on `ChungTuPdfTemplate`. Catalog scalars gain `description` + `supportsLabel`. `formatDerivedNamedRangeValue` takes optional `{ label }` and drops hardcoded prefixes. Export loads labels from selected template. Superadmin edits labels per version; shared catalog panel becomes one searchable scalar table.

**Tech Stack:** Prisma, Node ESM + `node:test`, React (packages/shared)

**Spec:** `docs/superpowers/specs/2026-09-05-template-field-labels-and-catalog-lookup-design.md`

## Global Constraints

- One `FIELD_*` cell: `label + value` if label set; else raw value
- Value from code/resolver only
- Labels per `ChungTuPdfTemplate` in `fieldLabelsJson`
- Only `supportsLabel: true` fields editable
- No hardcoded prefix fallback when label missing/empty
- Lookup: scalar-only table (name + description) + realtime search
- No new dependencies

---

## File Map

| File | Role |
|------|------|
| `prisma/schema.prisma` + migration | `fieldLabelsJson` |
| `chung-tu-pdf-field-catalog.js` | `description`, `supportsLabel` |
| `chung-tu-named-range-display.js` | label-aware format; remove PDF prefix map |
| `chung-tu-pdf-map.util.js` | pass `fieldLabels` into format |
| PDF export / batch / BKMH monthly | load template labels into payload build |
| Template service + routes + validator | get/update `fieldLabelsJson` |
| `SuperadminChungTuPdfCategoryTemplates.jsx` | label editor UI |
| `ChungTuPdfFieldCatalogPanel.jsx` | searchable scalar table |
| Tests | format, map, catalog, API |

---

### Task 1: Schema `fieldLabelsJson`

**Files:** `quanluong-app-be/prisma/schema.prisma` + migration

- [ ] Add `fieldLabelsJson Json?` on `ChungTuPdfTemplate`
- [ ] Migrate (drift workaround if needed) + `prisma generate`
- [ ] Commit: `feat(chung-tu): add fieldLabelsJson on PDF templates`

---

### Task 2: Catalog metadata + format without hardcoded prefixes

**Files:**
- `chung-tu-pdf-field-catalog.js` (+ test)
- `chung-tu-named-range-display.js` (+ rewrite tests)
- `chung-tu-pdf-map.util.js` (+ update tests)

**Catalog:** For each scalar, set `description` (migrate current `label` text → `description`; keep `label` as alias of `description` for one release OR replace `label` with `description` and update FE). Add `supportsLabel: true` for: `quyenSo`, `soChungTu`, `tongTienBangChu`, `hoTenNguoiMua`, `boPhan`, `nguoiGiaoHang`, `diaChi`, `canCuBkmh`, `nhapTaiKho` (others false).

**Format API:**

```js
formatDerivedNamedRangeValue(fieldKey, rawValue, { label } = {}) {
  const value = String(rawValue ?? "").trim();
  if (!value) return "";
  const prefix = String(label ?? "").trim();
  if (!prefix) return value;
  if (value.startsWith(prefix) || value.startsWith(prefix.trimEnd())) return value;
  return `${prefix}${value}`;
}
```

Remove `LABELED_FIELD_PREFIXES` usage from this function.

**pickMappedFields:**

```js
pickMappedFields(context, fieldKeys, { categoryKey, fieldLabels } = {}) {
  // ...
  const label = fieldLabels?.[fieldKey] ?? fieldLabels?.[key] ?? "";
  out[key] = fieldKey ? formatDerivedNamedRangeValue(fieldKey, cell, { label }) : cell;
}
```

- [ ] TDD: empty label → raw; with label → prefixed; no double prefix
- [ ] Update old tests that expected `Số:` without passing label — pass `{ label: "Số: " }` in those tests OR expect raw value
- [ ] Commit: `feat(chung-tu): template-driven field labels in PDF map`

---

### Task 3: Wire export paths to template fieldLabelsJson

**Files:** batch export, single PDF export, BKMH monthly export — wherever `buildDocumentServicePayload` / `pickMappedFields` is called after loading template.

- Load `template.fieldLabelsJson` (normalize to plain object of strings)
- Pass as `fieldLabels` into payload builder
- Unit/integration test: mock template with `{ soChungTu: "Số: " }` → output has prefix; `{}` → raw

- [ ] Commit: `feat(chung-tu): apply template field labels on PDF export`

---

### Task 4: API update field labels on template

**Files:** validator, controller, template service, routes, FE api

- `PUT /chungtuquyettoan/pdf-templates/:id/field-labels` (or patch existing update)
- Body: `{ fieldLabels: { [fieldKey]: string } }` — only keys with `supportsLabel` retained; strip unknown
- Allow update when status ≠ `retired`
- Return template including `fieldLabels`

- [ ] Tests for filter unknown keys / retired reject
- [ ] Commit: `feat(chung-tu): API to update PDF template field labels`

---

### Task 5: Superadmin label editor UI

**Files:** `SuperadminChungTuPdfCategoryTemplates.jsx`, `chungTuPdfApi.js`

- When template selected: section listing `supportsLabel` scalars from catalog query
- Controlled inputs bound to local state seeded from `template.fieldLabels`
- Save button → mutation Task 4
- Hint: include trailing space / `: ` in label if desired (e.g. `Số: `)

- [ ] Commit: `feat(chung-tu): superadmin UI for per-template field labels`

---

### Task 6: Scalar catalog lookup table + search

**Files:** `ChungTuPdfFieldCatalogPanel.jsx` (+ source test if exists)

- Remove table-columns block from this panel
- One table: columns Tên (`namedRange` + mono `fieldKey`), Mô tả (`description` or `label`)
- Search input filters rows by substring match on name/description (case-insensitive) on each keystroke
- Keep used by user + admin tabs

- [ ] Commit: `feat(chung-tu): searchable scalar field catalog table`

---

## Spec coverage

| Spec | Task |
|------|------|
| fieldLabelsJson | T1 |
| supportsLabel + description | T2 |
| format no hardcoded prefix | T2 |
| export uses labels | T3 |
| Superadmin save API | T4–T5 |
| Lookup table + search | T6 |

## Note

Existing templates start with null/empty labels → PDFs show raw values until Superadmin configures labels (breaking change vs old hardcoded prefixes — intentional per spec).
