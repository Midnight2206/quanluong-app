# Chứng từ PDF templates → Superadmin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Excel PDF template upload/management to Superadmin dashboard (one tab per AVAILABLE document type); unit users only pick active templates when exporting.

**Architecture:** Keep `/chungtuquyettoan/pdf-templates*` APIs. Gate POST/DELETE with `superadminMiddleware`. Extend GET list with `includeInactive` for superadmin only. Add Superadmin dashboard panel; strip upload UI from `ChungTuExportWorkspace`.

**Tech Stack:** Express + Prisma, Next.js `apps/superadmin`, shared React package, existing `chungTuPdfApi`.

## Global Constraints

- Only Superadmin may upload / deactivate PDF templates.
- Unit users select among `isActive=true` templates only; no upload/delete UI on main app.
- Signature settings tab stays on main app (`ChungTuCategoryWorkspace`).
- Superadmin UI: dashboard tab `chung-tu-pdf-templates`; AVAILABLE categories only as sub-tabs.
- Per category: upload, list (incl. inactive), deactivate, inspect Named Ranges/fields + read-only catalog.
- Data-input mapping forms are out of scope.
- Pattern for write routes: `auth` + `superadminMiddleware` (same as Drive `template-catalog`).

---

## File map

| File | Responsibility |
|------|----------------|
| `chung-tu-pdf-template.service.js` | `includeInactive` list; fields for inactive when allowed |
| `chung-tu-pdf-template.service.test.js` | Unit tests for list/fields flags |
| `chung-tu-quyet-toan.validator.js` | Query `includeInactive` |
| `chung-tu-quyet-toan.controller.js` | Pass flags from user type |
| `chung-tu-quyet-toan.routes.js` | `superadminMiddleware` on POST/DELETE |
| `chung-tu-quyet-toan.route-definitions.js` | Descriptions |
| `chungTuPdfApi.js` | `includeInactive` on list query |
| `superadminDashboardTabMeta.js` | New dashboard tab |
| `routeAccessRegistry.js` | Access key |
| `DashboardTabPages.jsx` | Export page component |
| `apps/superadmin/.../chung-tu-pdf-templates/page.jsx` | Route |
| `SuperadminChungTuPdfTemplatesPanel.jsx` | SA UI |
| `ChungTuExportWorkspace.jsx` | Remove upload; empty-state copy |

---

### Task 1: BE list `includeInactive` + fields for inactive (superadmin)

**Files:**
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.test.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.validator.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.controller.js`

**Interfaces:**
- Produces: `listChungTuPdfTemplates({ categoryKey, includeInactive?: boolean })`
- Produces: `getChungTuPdfTemplateFields({ id, allowInactive?: boolean })`

- [ ] **Step 1: Extend failing tests**

In `chung-tu-pdf-template.service.test.js`, after existing list test, add:

```javascript
test("listChungTuPdfTemplates includeInactive omits isActive filter", async () => {
  prismaFindMany.mock.resetCalls();
  await listChungTuPdfTemplates({
    categoryKey: "bang-ke-mua-hang",
    includeInactive: true,
  });
  const call = prismaFindMany.mock.calls[0].arguments[0];
  assert.equal(call.where.categoryKey, "bang-ke-mua-hang");
  assert.equal(Object.prototype.hasOwnProperty.call(call.where, "isActive"), false);
});

test("getChungTuPdfTemplateFields allowInactive returns inactive row fields", async () => {
  prismaFindUnique.mock.mockImplementation(async () => ({
    id: 3,
    isActive: false,
    documentServiceTemplateId: 42,
  }));
  getTemplateFields.mock.resetCalls();
  const result = await getChungTuPdfTemplateFields({ id: 3, allowInactive: true });
  assert.equal(result.template.id, 3);
  assert.equal(getTemplateFields.mock.calls.length, 1);
});
```

- [ ] **Step 2: Run tests — expect FAIL on new assertions**

Run: `node --experimental-test-module-mocks --test quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.test.js`

- [ ] **Step 3: Implement service changes**

```javascript
async function listChungTuPdfTemplates({ categoryKey, includeInactive = false }) {
  const normalizedCategoryKey = normalizeCategoryKey(categoryKey);
  assertSupportedPdfCategory(normalizedCategoryKey);
  return prisma.chungTuPdfTemplate.findMany({
    where: {
      categoryKey: normalizedCategoryKey,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ updatedAt: "desc" }],
  });
}

async function getChungTuPdfTemplateFields({ id, allowInactive = false }) {
  const row = await prisma.chungTuPdfTemplate.findUnique({
    where: { id: Number(id) },
  });
  if (!row || (!row.isActive && !allowInactive)) {
    throw new AppError({
      message: "Không tìm thấy mẫu PDF.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  const fields = await getTemplateFields(row.documentServiceTemplateId);
  return { template: row, fields };
}
```

- [ ] **Step 4: Validator + controller**

```javascript
// validator
const chungTuPdfTemplateListQuerySchema = z.object({
  categoryKey: chungTuPdfCategoryKeySchema,
  includeInactive: z
    .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
    .optional()
    .transform((v) => v === true || v === "true" || v === "1"),
});
```

```javascript
function isSuperadminUser(user) {
  return user?.type?.name === "superadmin";
}

async function listChungTuPdfTemplatesController(req, res) {
  const wantInactive = Boolean(req.validatedQuery.includeInactive);
  const includeInactive = wantInactive && isSuperadminUser(req.user);
  const items = await listChungTuPdfTemplates({
    categoryKey: req.validatedQuery.categoryKey,
    includeInactive,
  });
  return respondSuccess(res, {
    message: "Danh sách mẫu PDF chứng từ.",
    data: { items },
  });
}

async function getChungTuPdfTemplateFieldsController(req, res) {
  const data = await getChungTuPdfTemplateFields({
    id: req.validatedParams.id,
    allowInactive: isSuperadminUser(req.user),
  });
  return respondSuccess(res, { message: "Schema mẫu PDF.", data });
}
```

Wire `getChungTuPdfTemplateFieldsController` if it already exists — only add `allowInactive`.

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-template.service.test.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.validator.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.controller.js
git commit -m "feat(chung-tu): allow superadmin to list inactive PDF templates"
```

---

### Task 2: Lock POST/DELETE pdf-templates to superadmin

**Files:**
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.routes.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.route-definitions.js`

**Interfaces:**
- Consumes: `superadminMiddleware` from `../../middlewares/superadmin.middleware.js`

- [ ] **Step 1: Update routes**

Replace POST/DELETE handlers to use `superadminMiddleware` **instead of** (or in addition before) `permissionMiddleware` WRITE — prefer **only** `superadminMiddleware` after auth (router already has auth):

```javascript
chungTuQuyetToanRouter.post(
  "/pdf-templates",
  superadminMiddleware,
  driveImportMulterMiddleware,
  validateRequest({ body: chungTuPdfTemplateUploadBodySchema }),
  asyncHandler(createChungTuPdfTemplateController),
);

chungTuQuyetToanRouter.delete(
  "/pdf-templates/:id",
  superadminMiddleware,
  validateRequest({ params: chungTuPdfTemplateIdParamSchema }),
  asyncHandler(deactivateChungTuPdfTemplateController),
);
```

Keep GET list/fields on existing READ permission middleware.

- [ ] **Step 2: Update route-definitions descriptions**

For `pdfTemplateCreate` / `pdfTemplateDelete` permission blocks, set description to state Superadmin-only (catalog VI may still list a code — if definitions require a permission object, keep READ unused or note in description; do not leave WRITE as the gate). Match how other superadmin-only routes in this file document themselves (Drive template-catalog create).

- [ ] **Step 3: Commit**

```bash
git add quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.routes.js \
  quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-quyet-toan.route-definitions.js
git commit -m "fix(chung-tu): restrict PDF template write APIs to superadmin"
```

---

### Task 3: FE API — `includeInactive` on template list

**Files:**
- Modify: `packages/shared/src/features/chung-tu-quyet-toan/api/chungTuPdfApi.js`

**Interfaces:**
- Produces: `useChungTuPdfTemplatesQuery(categoryKey, { includeInactive?: boolean, ... })`

- [ ] **Step 1: Update query**

```javascript
export function useChungTuPdfTemplatesQuery(categoryKey, options = {}) {
  const { skip, includeInactive = false, ...rest } = options;
  const key = normalizeCategoryKey(categoryKey);
  return useQuery({
    queryKey: qk.chungTuQuyetToan.pdfTemplates(key, includeInactive ? "all" : "active"),
    queryFn: () =>
      apiRequest({
        url: "/chungtuquyettoan/pdf-templates",
        method: "get",
        params: {
          categoryKey: key,
          ...(includeInactive ? { includeInactive: true } : {}),
        },
      }),
    select: (data) => (Array.isArray(data?.items) ? data.items : []),
    enabled: Boolean(skip !== true && key.length > 0),
    ...rest,
  });
}
```

- [ ] **Step 2: Update `queryKeys.js` if `pdfTemplates` arity changes**

Ensure `qk.chungTuQuyetToan.pdfTemplates(categoryKey, scope = "active")` accepts optional second arg without breaking existing callers.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/features/chung-tu-quyet-toan/api/chungTuPdfApi.js \
  packages/shared/src/app/query/queryKeys.js
git commit -m "feat(chung-tu): FE list PDF templates with includeInactive"
```

---

### Task 4: Superadmin dashboard route + panel shell

**Files:**
- Modify: `packages/shared/src/pages/dashboard/superadminDashboardTabMeta.js`
- Modify: `packages/shared/src/features/route-access/routeAccessRegistry.js`
- Modify: `packages/shared/src/pages/dashboard/DashboardTabPages.jsx`
- Create: `apps/superadmin/app/(private)/dashboard/chung-tu-pdf-templates/page.jsx`
- Create: `packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfTemplatesPanel.jsx` (shell with category tabs)

- [ ] **Step 1: Meta + registry**

```javascript
// superadminDashboardTabMeta.js — append
{
  path: "chung-tu-pdf-templates",
  label: "Mẫu chứng từ",
  routeAccessKey: "dashboard-chung-tu-pdf-templates",
},
```

```javascript
// routeAccessRegistry.js
"dashboard-chung-tu-pdf-templates": {
  description: "Quản lý mẫu PDF chứng từ quyết toán (upload Excel)",
  requiredPermissions: [],
},
```

- [ ] **Step 2: DashboardTabPages export**

```javascript
export function DashboardChungTuPdfTemplatesPage() {
  return <SuperadminChungTuPdfTemplatesPanel />;
}
```

- [ ] **Step 3: Next page** (copy `meal-allowance-rates/page.jsx` pattern)

```jsx
"use client";
import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { DashboardChungTuPdfTemplatesPage } from "@/pages/dashboard/DashboardTabPages";

export default function DashboardChungTuPdfTemplatesRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-chung-tu-pdf-templates">
      <DashboardChungTuPdfTemplatesPage />
    </RouteApiGuard>
  );
}
```

- [ ] **Step 4: Panel shell — TabPanel of AVAILABLE categories**

```jsx
"use client";
import { useMemo } from "react";
import { TabPanel } from "@/components/common/TabPanel";
import {
  CHUNG_TU_CATEGORY_CONFIG_LIST,
} from "@/pages/chungTuQuyetToan/chungTuCategoryConfig";
import { CHUNG_TU_DOC_TAB_STATUS } from "@/pages/chungTuQuyetToan/chungTuQuyetToanTabsMeta";
import { SuperadminChungTuPdfCategoryTemplates } from "./SuperadminChungTuPdfCategoryTemplates.jsx";

export function SuperadminChungTuPdfTemplatesPanel() {
  const tabs = useMemo(
    () =>
      CHUNG_TU_CATEGORY_CONFIG_LIST.filter(
        (c) => c.status === CHUNG_TU_DOC_TAB_STATUS.AVAILABLE,
      ).map((c) => ({
        id: c.categoryKey,
        label: c.label,
        panel: <SuperadminChungTuPdfCategoryTemplates categoryKey={c.categoryKey} />,
      })),
    [],
  );
  return (
    <TabPanel
      persistId="sa-chungtu-pdf-templates"
      defaultTabId={tabs[0]?.id}
      scrollableTabList
      stickyTabList
      stickyTabListLevel={0}
      tabs={tabs}
    />
  );
}
```

Create stub `SuperadminChungTuPdfCategoryTemplates.jsx` that renders `categoryKey` text for now (filled in Task 5).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/pages/dashboard/superadminDashboardTabMeta.js \
  packages/shared/src/features/route-access/routeAccessRegistry.js \
  packages/shared/src/pages/dashboard/DashboardTabPages.jsx \
  packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfTemplatesPanel.jsx \
  packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfCategoryTemplates.jsx \
  apps/superadmin/app/(private)/dashboard/chung-tu-pdf-templates/page.jsx
git commit -m "feat(superadmin): add Chứng từ PDF templates dashboard tab"
```

---

### Task 5: Superadmin category panel — upload, list, deactivate, fields, catalog

**Files:**
- Modify: `packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfCategoryTemplates.jsx`

**Interfaces:**
- Consumes: `useChungTuPdfTemplatesQuery(categoryKey, { includeInactive: true })`, `useUploadChungTuPdfTemplateMutation`, `useDeactivateChungTuPdfTemplateMutation`, `useChungTuPdfTemplateFieldsQuery`, `useChungTuPdfFieldCatalogQuery`

- [ ] **Step 1: Implement UI**

Layout (reuse Card / Button / fieldClass patterns from `SuperadminMealAllowanceRatesPanel` or export workspace):

1. Upload form: file input accept `.xlsx`, displayName, version; submit → upload mutation with fixed `categoryKey`
2. Table of templates: id, displayName, version, isActive badge, updatedAt; for `isActive` rows show button **Ngừng dùng** → deactivate mutation + confirm
3. Click row → set `selectedId` → fields query → show lists of field names / column keys from payload (normalize like ExportWorkspace `extractSignatureBlock` / fields container)
4. Collapsible or side panel: field catalog from `useChungTuPdfFieldCatalogQuery` (read-only)

Vietnamese copy: “Tải mẫu Excel”, “Ngừng dùng”, “Named Range trên mẫu”, “Catalog gợi ý (chuẩn hệ thống)”.

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/pages/dashboard/superadmin/SuperadminChungTuPdfCategoryTemplates.jsx
git commit -m "feat(superadmin): manage PDF templates per chứng từ category"
```

---

### Task 6: Strip upload UI from main-app export workspace

**Files:**
- Modify: `packages/shared/src/pages/chungTuQuyetToan/ChungTuExportWorkspace.jsx`

- [ ] **Step 1: Remove upload state and handlers**

Delete: `uploadFile`, `uploadDisplayName`, `uploadVersion`, `uploadTemplate` mutation, `handleUploadTemplate`, and the JSX block titled roughly “Tải mẫu .xlsx mới” / “Tải mẫu Excel” (around lines 809–876).

Keep template `<select>` bound to `useChungTuPdfTemplatesQuery(categoryKey)` **without** `includeInactive`.

- [ ] **Step 2: Empty state when `templates.length === 0`**

Show message:

`Chưa có mẫu PDF do quản trị hệ thống cấu hình. Liên hệ Superadmin để tải mẫu lên.`

Disable Xuất PDF when no template selected / none available.

- [ ] **Step 3: Smoke build**

Run: `npm run build:web` (or lint touched file). Ensure no unused imports.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/pages/chungTuQuyetToan/ChungTuExportWorkspace.jsx
git commit -m "refactor(chung-tu): remove PDF template upload from unit export UI"
```

---

### Task 7: Dev smoke checklist

- [ ] **Step 1: Rebuild/restart `app` if BE routes changed; UI hot-reloads via shared mount**

- [ ] **Step 2: As non-superadmin**, call or attempt upload — expect 403; export UI has no upload controls

- [ ] **Step 3: As superadmin on `:8081`**, open **Mẫu chứng từ** → upload minimal xlsx → see Named Ranges → deactivate → list still shows inactive with badge

- [ ] **Step 4: On `:8080` unit app**, picker shows only active templates; empty copy if none

---

## Plan self-review

| Spec requirement | Task |
|------------------|------|
| Superadmin-only upload/deactivate | Task 2 |
| User picks active templates | Task 6 + Task 1 default list |
| Signature tab stays | No change (explicit) |
| Dashboard tab + AVAILABLE sub-tabs | Task 4–5 |
| Upload/list/deactivate/fields/catalog | Task 5 |
| `includeInactive` SA-only | Task 1 |
| Mapping out of scope | Not in plan |

No TBD placeholders in task steps.
