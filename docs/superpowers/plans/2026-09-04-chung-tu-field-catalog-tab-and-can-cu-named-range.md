# Catalog Named Range Tab + FIELD_can_cu_bkmh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose `FIELD_can_cu_bkmh` in the PDF field catalog (with resolve alias) and move catalog lookup into dedicated tabs on user Chứng từ quyết toán and admin template upload.

**Architecture:** Extend static `chung-tu-pdf-field-catalog.js` + scalar resolve alias. Extract a shared read-only `ChungTuPdfFieldCatalogPanel` from the existing `<details>` UI; mount it as a sibling tab next to document categories (user + superadmin). Remove inline catalog collapses.

**Tech Stack:** Node ESM + `node:test`, React (packages/shared), existing RTK Query `useChungTuPdfFieldCatalogQuery`

**Spec:** `docs/superpowers/specs/2026-09-04-chung-tu-field-catalog-tab-and-can-cu-named-range-design.md`

## Global Constraints

- No new dependencies
- Named range chuẩn: `FIELD_can_cu_bkmh` → `canCuBkmh`; legacy `canCuBkmh` vẫn nhận
- Tab id: `field-catalog`; label: `Tra cứu field`
- Gỡ hẳn `<details>` catalog trên Xuất và upload mẫu
- Không filter catalog theo category
- Không đổi format/text nguồn `canCuBkmh`

---

## File Map

| File | Role |
|------|------|
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-field-catalog.js` | Thêm scalar `FIELD_can_cu_bkmh` |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-column-alias.util.js` | Alias `can_cu_bkmh` → `canCuBkmh` (explicit) |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-column-alias.util.test.js` | Tests resolve |
| `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-field-catalog.test.js` | Create: assert catalog entry |
| `packages/shared/src/pages/chungTuQuyetToan/ChungTuPdfFieldCatalogPanel.jsx` | Shared read-only catalog UI |
| `packages/shared/src/pages/chungTuQuyetToan/ChungTuQuyetToanPage.jsx` | User tab `field-catalog` |
| `packages/shared/src/pages/chungTuQuyetToan/ChungTuExportWorkspace.jsx` | Remove `<details>` + unused catalog query/import |
| `packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfTemplatesPanel.jsx` | Admin tab `field-catalog` |
| `packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfCategoryTemplates.jsx` | Remove `<details>` + unused catalog query/import |

---

### Task 1: Backend — catalog entry + resolve alias

**Files:**
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-field-catalog.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-column-alias.util.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-column-alias.util.test.js`
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-field-catalog.test.js`

**Interfaces:**
- Consumes: existing `resolveScalarFieldKey`, `getChungTuPdfFieldCatalog`
- Produces: catalog scalar `{ namedRange: "FIELD_can_cu_bkmh", fieldKey: "canCuBkmh", label: "..." }`; `resolveScalarFieldKey("FIELD_can_cu_bkmh"|"can_cu_bkmh") === "canCuBkmh"`

- [ ] **Step 1: Write failing resolve tests**

Append to `chung-tu-pdf-column-alias.util.test.js`:

```js
test("resolveScalarFieldKey maps can_cu_bkmh to canCuBkmh", () => {
  assert.equal(resolveScalarFieldKey("FIELD_can_cu_bkmh"), "canCuBkmh");
  assert.equal(resolveScalarFieldKey("can_cu_bkmh"), "canCuBkmh");
  assert.equal(resolveScalarFieldKey("canCuBkmh"), "canCuBkmh");
});
```

Create `chung-tu-pdf-field-catalog.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { getChungTuPdfFieldCatalog } from "./chung-tu-pdf-field-catalog.js";

test("catalog includes FIELD_can_cu_bkmh → canCuBkmh", () => {
  const { scalarFields } = getChungTuPdfFieldCatalog();
  const row = scalarFields.find((f) => f.namedRange === "FIELD_can_cu_bkmh");
  assert.ok(row);
  assert.equal(row.fieldKey, "canCuBkmh");
  assert.match(String(row.label), /căn cứ|BKMH/i);
});
```

- [ ] **Step 2: Run tests — catalog must fail; resolve may already pass via snakeToCamel**

```bash
cd quanluong-app-be && node --test \
  src/modules/chung-tu-quyet-toan/chung-tu-pdf-column-alias.util.test.js \
  src/modules/chung-tu-quyet-toan/chung-tu-pdf-field-catalog.test.js
```

Expected: catalog test FAIL (no entry). Resolve may PASS already — still add explicit alias in Step 3 for clarity next to other STATIC_ALIASES.

- [ ] **Step 3: Implement catalog + alias**

In `chung-tu-pdf-field-catalog.js`, add to `scalarFields` (after `FIELD_bo_phan` or near PNK-related fields):

```js
{
  namedRange: "FIELD_can_cu_bkmh",
  fieldKey: "canCuBkmh",
  label:
    "Căn cứ theo BKMH (số, ngày…) — chủ yếu PNK; legacy Named Range `canCuBkmh` vẫn được nhận",
},
```

In `chung-tu-pdf-column-alias.util.js` `STATIC_ALIASES`, add:

```js
can_cu_bkmh: "canCuBkmh",
```

Do **not** change `chung-tu-named-range-display.js` (legacy `cancubkmh` already mapped).

- [ ] **Step 4: Re-run tests — expect PASS**

Same command as Step 2. Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-field-catalog.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-field-catalog.test.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-column-alias.util.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-column-alias.util.test.js
git commit -m "$(cat <<'EOF'
feat(chung-tu): add FIELD_can_cu_bkmh to PDF field catalog

EOF
)"
```

---

### Task 2: Shared catalog panel + wire user/admin tabs; remove inline `<details>`

**Files:**
- Create: `packages/shared/src/pages/chungTuQuyetToan/ChungTuPdfFieldCatalogPanel.jsx`
- Modify: `packages/shared/src/pages/chungTuQuyetToan/ChungTuQuyetToanPage.jsx`
- Modify: `packages/shared/src/pages/chungTuQuyetToan/ChungTuExportWorkspace.jsx`
- Modify: `packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfTemplatesPanel.jsx`
- Modify: `packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfCategoryTemplates.jsx`

**Interfaces:**
- Consumes: `useChungTuPdfFieldCatalogQuery` from `@/features/chung-tu-quyet-toan/api/chungTuPdfApi`
- Produces: `export function ChungTuPdfFieldCatalogPanel()` — read-only catalog UI

- [ ] **Step 1: Create `ChungTuPdfFieldCatalogPanel.jsx`**

Lift the existing catalog body from `ChungTuExportWorkspace` / superadmin (same structure: hint + loading + two columns). Full file:

```jsx
"use client";

import { BookOpen, Loader2 } from "lucide-react";
import { useChungTuPdfFieldCatalogQuery } from "@/features/chung-tu-quyet-toan/api/chungTuPdfApi";

export function ChungTuPdfFieldCatalogPanel() {
  const { data: fieldCatalog, isLoading: fieldCatalogLoading } =
    useChungTuPdfFieldCatalogQuery();

  return (
    <div className="space-y-3 p-3 sm:p-4">
      <div className="flex items-start gap-2">
        <BookOpen className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Tra cứu Named Range / field key</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Dùng Named Range `FIELD_*` cho dữ liệu đơn và `TABLE_HEADER`/`TABLE_DATA_ROW` cho phần
            bảng dòng hàng khi thiết kế mẫu Excel.
          </p>
        </div>
      </div>

      {fieldCatalogLoading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Đang tải catalog…
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/10 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
              Scalar fields
            </p>
            <div className="space-y-2 text-xs">
              {(fieldCatalog?.scalarFields ?? []).map((field) => (
                <div key={field.namedRange} className="rounded-md bg-muted/25 px-2.5 py-2">
                  <p className="font-mono text-[11px] text-foreground">{field.namedRange}</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {field.fieldKey} · {field.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/10 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
              Gợi ý tiêu đề cột bảng
            </p>
            <div className="space-y-2 text-xs">
              {(fieldCatalog?.tableColumns ?? []).map((column, index) => (
                <div
                  key={`${column.label}-${column.fieldKey}-${index}`}
                  className="rounded-md bg-muted/25 px-2.5 py-2"
                >
                  <p className="font-medium text-foreground">{column.label}</p>
                  <p className="mt-0.5 text-muted-foreground">fieldKey: {column.fieldKey}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire user tab on `ChungTuQuyetToanPage`**

Import `ChungTuPdfFieldCatalogPanel`. After building category tabs, append:

```js
{
  id: "field-catalog",
  label: "Tra cứu field",
  panel: <ChungTuPdfFieldCatalogPanel />,
},
```

Keep `defaultTabId={DEFAULT_CHUNG_TU_CATEGORY_KEY}` (first available category — do not default to catalog).

- [ ] **Step 3: Wire admin tab on `SuperadminChungTuPdfTemplatesPanel`**

Import `ChungTuPdfFieldCatalogPanel` from `@/pages/chungTuQuyetToan/ChungTuPdfFieldCatalogPanel`. Change `tabs` to:

```js
const tabs = useMemo(
  () => [
    ...CHUNG_TU_CATEGORY_CONFIG_LIST.filter(
      (c) => c.status === CHUNG_TU_DOC_TAB_STATUS.AVAILABLE,
    ).map((c) => ({
      id: c.categoryKey,
      label: c.label,
      panel: <SuperadminChungTuPdfCategoryTemplates categoryKey={c.categoryKey} />,
    })),
    {
      id: "field-catalog",
      label: "Tra cứu field",
      panel: <ChungTuPdfFieldCatalogPanel />,
    },
  ],
  [],
);
```

Keep `defaultTabId={tabs[0]?.id}` (first category).

- [ ] **Step 4: Remove inline catalog from export + category templates**

In `ChungTuExportWorkspace.jsx`:
- Delete the entire `<details>…Catalog Named Range…</details>` block (~lines 811–862)
- Remove `useChungTuPdfFieldCatalogQuery` usage and import if unused
- Remove `BookOpen` from lucide import if unused

In `SuperadminChungTuPdfCategoryTemplates.jsx`:
- Delete the entire `<details>…Catalog gợi ý…</details>` block
- Remove `useChungTuPdfFieldCatalogQuery` usage and import if unused
- Remove `BookOpen` if unused

- [ ] **Step 5: Smoke check (manual / lint)**

- Confirm no leftover `fieldCatalog` / `fieldCatalogLoading` references in the two cleaned files
- Open Chứng từ quyết toán → tab **Tra cứu field** → thấy `FIELD_can_cu_bkmh`
- Open Superadmin tải template → tab **Tra cứu field** → cùng nội dung
- Màn Xuất / upload mẫu không còn khối catalog gập

- [ ] **Step 6: Commit**

```bash
git add \
  packages/shared/src/pages/chungTuQuyetToan/ChungTuPdfFieldCatalogPanel.jsx \
  packages/shared/src/pages/chungTuQuyetToan/ChungTuQuyetToanPage.jsx \
  packages/shared/src/pages/chungTuQuyetToan/ChungTuExportWorkspace.jsx \
  packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfTemplatesPanel.jsx \
  packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfCategoryTemplates.jsx
git commit -m "$(cat <<'EOF'
feat(chung-tu): move PDF field catalog into Tra cứu field tabs

EOF
)"
```

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| `FIELD_can_cu_bkmh` in catalog | T1 |
| Resolve alias + legacy `canCuBkmh` | T1 (+ existing named-range-display) |
| Shared panel | T2 |
| User top-level tab | T2 |
| Admin top-level tab | T2 |
| Remove `<details>` | T2 |
| No category filter / no canCu text change | Out of scope — not tasked |

No placeholders left in steps.
