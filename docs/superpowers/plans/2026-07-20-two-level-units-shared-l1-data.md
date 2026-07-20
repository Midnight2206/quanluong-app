# Đơn vị 2 cấp + kho dùng chung cấp 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giới hạn cây đơn vị còn 2 cấp; LTTP / bảng giá / chức danh dùng chung kho cấp 1 (cấp 2 chỉ đọc); bỏ đồng bộ/fork; xóa 3 loại dữ liệu đang gắn cấp con; chỉ cấp 1 được tạo `admin`.

**Architecture:** `resolvePrivateStorageUnitId` luôn trả về ancestor `depth === 0` cho 3 kind private; write path chặn khi `logicalUnit.depth !== 0`. Job titles chuyển sang cùng mô hình data-scope như LTTP. Cleanup script xóa (không migrate) bản ghi 3 loại ở unit `depth >= 1`.

**Tech Stack:** Node/Express, Prisma 7, MariaDB, React (packages/shared + apps/web), `node:test`.

**Spec:** `docs/superpowers/specs/2026-07-20-two-level-units-shared-l1-data-design.md`

## Global Constraints

- `UNITS_MAX_TREE_DEPTH = 2` (depth chỉ `0` hoặc `1`)
- 3 kind dùng chung: `LTTP_COMMODITY`, `LTTP_PRICE_TABLE`, `JOB_TITLE`
- Cấp 2: đọc được; tạo/sửa/xóa 3 loại → 403
- Không migrate 3 loại lên cấp 1 — **xóa** dữ liệu cấp con
- `type = admin` chỉ khi `unit.depth === 0`
- Loại dữ liệu khác (phiếu xuất, meal roster, kitchen, chứng từ) không đổi scope trong plan này

---

## File map

| File | Responsibility |
|------|----------------|
| `quanluong-app-be/src/modules/units/units.constants.js` | `UNITS_MAX_TREE_DEPTH = 2` |
| `quanluong-app-be/src/shared/units/unit-level.helpers.js` | `getLevel1UnitId`, `assertLogicalUnitIsLevel1ForWrite` |
| `quanluong-app-be/src/shared/data-scope/unit-data-policy.service.js` | Resolve storage → level-1 cho 3 kind |
| `quanluong-app-be/src/modules/lttp/lttp.service.js` | Write guard trên CRUD commodity/price |
| `quanluong-app-be/src/modules/job-titles/*` | Data-scope + storage L1 + bỏ apply-down |
| `quanluong-app-be/src/modules/lttp/lttp.routes.js` (+ definitions/controller/validator/constants) | Gỡ apply-to-unit |
| `quanluong-app-be/src/modules/users/users.service.js` | Chặn admin ở depth ≥ 1 |
| `quanluong-app-be/scripts/cleanup-level2-shared-kinds.js` | Flatten + xóa 3 loại cấp con |
| `packages/shared/.../dashboardTabMeta.js` + related | Bỏ tab đồng bộ |
| `packages/shared/.../SuperadminUnitsPanel.jsx` | Parent picker chỉ depth 0 |
| `packages/shared/.../SuperadminUsersPanel.jsx` | Ẩn type admin khi unit cấp 2 |

---

### Task 1: Max depth = 2 + helper level-1

**Files:**
- Modify: `quanluong-app-be/src/modules/units/units.constants.js`
- Create: `quanluong-app-be/src/shared/units/unit-level.helpers.js`
- Create: `quanluong-app-be/src/shared/units/unit-level.helpers.test.js`
- Modify: `quanluong-app-be/src/modules/units/units.service.js` (chỉ nếu message cần rõ hơn — logic đã dùng constant)

**Interfaces:**
- Produces: `getLevel1UnitId(unitId: number): Promise<number>`
- Produces: `assertLogicalUnitIsLevel1ForWrite(logicalUnitId: number): Promise<void>` — throws AppError 403 nếu depth !== 0

- [ ] **Step 1: Write failing tests**

```javascript
// quanluong-app-be/src/shared/units/unit-level.helpers.test.js
import assert from "node:assert/strict";
import test from "node:test";

// Pure helpers extracted for path/depth math without DB:
import { pickLevel1IdFromChain } from "./unit-level.helpers.js";

test("pickLevel1IdFromChain: self is root", () => {
  assert.equal(pickLevel1IdFromChain([{ id: 5, depth: 0, parentId: null }]), 5);
});

test("pickLevel1IdFromChain: child picks parent depth 0", () => {
  assert.equal(
    pickLevel1IdFromChain([
      { id: 9, depth: 1, parentId: 5 },
      { id: 5, depth: 0, parentId: null },
    ]),
    5,
  );
});
```

- [ ] **Step 2: Run test — expect FAIL (module missing)**

Run: `cd quanluong-app-be && node --test src/shared/units/unit-level.helpers.test.js`

Expected: FAIL cannot find module / export

- [ ] **Step 3: Implement helpers + set constant**

`units.constants.js`:

```javascript
const UNITS_MAX_TREE_DEPTH = 2;
```

`unit-level.helpers.js`:

```javascript
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

/** @param {{ id: number, depth: number, parentId: number | null }[]} selfToRoot */
export function pickLevel1IdFromChain(selfToRoot) {
  const root = selfToRoot.find((u) => u.depth === 0) ?? selfToRoot[selfToRoot.length - 1];
  if (!root) {
    throw new AppError({
      message: "Unit was not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  return root.id;
}

async function loadSelfToRoot(unitId) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { id: true, depth: true, parentId: true, path: true },
  });
  if (!unit) {
    throw new AppError({
      message: "Unit was not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  const ids = (unit.path || "")
    .split("/")
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length) {
    const rows = await prisma.unit.findMany({
      where: { id: { in: ids } },
      select: { id: true, depth: true, parentId: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return [...ids].reverse().map((id) => byId.get(id)).filter(Boolean);
  }
  // fallback walk parentId
  const chain = [];
  let cur = unit;
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.push({ id: cur.id, depth: cur.depth, parentId: cur.parentId });
    if (cur.parentId == null) break;
    cur = await prisma.unit.findUnique({
      where: { id: cur.parentId },
      select: { id: true, depth: true, parentId: true },
    });
  }
  return chain;
}

export async function getLevel1UnitId(unitId) {
  const chain = await loadSelfToRoot(unitId);
  return pickLevel1IdFromChain(chain);
}

export async function assertLogicalUnitIsLevel1ForWrite(logicalUnitId) {
  const unit = await prisma.unit.findUnique({
    where: { id: logicalUnitId },
    select: { id: true, depth: true },
  });
  if (!unit) {
    throw new AppError({
      message: "Unit was not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  if (unit.depth !== 0) {
    throw new AppError({
      message: "Chỉ đơn vị cấp 1 được tạo/sửa dữ liệu dùng chung (LTTP, bảng giá, chức danh)",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd quanluong-app-be && node --test src/shared/units/unit-level.helpers.test.js`

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/units/units.constants.js \
  quanluong-app-be/src/shared/units/unit-level.helpers.js \
  quanluong-app-be/src/shared/units/unit-level.helpers.test.js
git commit -m "feat(units): max depth 2 and level-1 helper"
```

---

### Task 2: Resolve storage luôn về cấp 1 cho 3 kind

**Files:**
- Modify: `quanluong-app-be/src/shared/data-scope/unit-data-policy.service.js`
- Create: `quanluong-app-be/src/shared/data-scope/unit-data-policy.level1.test.js` (pure unit test of kind gate if extracted; otherwise document manual check)

**Interfaces:**
- Consumes: `getLevel1UnitId` from Task 1
- Modifies: `resolvePrivateStorageUnitId` — early branch for the 3 kinds

- [ ] **Step 1: Change `resolvePrivateStorageUnitId`**

After public-kind check, before share-grant:

```javascript
import { getLevel1UnitId } from "../units/unit-level.helpers.js";

const LEVEL1_SHARED_KINDS = new Set([
  "LTTP_COMMODITY",
  "LTTP_PRICE_TABLE",
  "JOB_TITLE",
]);

// inside resolvePrivateStorageUnitId, after visibility check:
if (LEVEL1_SHARED_KINDS.has(dataKind)) {
  const storageUnitId = await getLevel1UnitId(logicalUnitId);
  return { storageUnitId, via: "level1_shared_kind" };
}
```

Do **not** consult share grant / INDEPENDENT chain for these three kinds.

- [ ] **Step 2: Smoke-check with node REPL or small script** (optional if DB unavailable — rely on Task 3 integration via service guards)

- [ ] **Step 3: Commit**

```bash
git add quanluong-app-be/src/shared/data-scope/unit-data-policy.service.js
git commit -m "feat(data-scope): LTTP/price/job-title storage always level-1"
```

---

### Task 3: Write guard LTTP commodity + price table

**Files:**
- Modify: `quanluong-app-be/src/modules/lttp/lttp.service.js`
- Create: `quanluong-app-be/src/modules/lttp/lttp-level1-write.guard.test.js` (test thin wrapper if extracted)

**Interfaces:**
- Consumes: `assertLogicalUnitIsLevel1ForWrite(dataScope.logicalUnitId)`
- Call on every create/update/delete for commodities and price tables (not list/get)

- [ ] **Step 1: Add helper at top of service (or import)**

```javascript
import { assertLogicalUnitIsLevel1ForWrite } from "../../shared/units/unit-level.helpers.js";

async function assertSharedKindWriteAllowed(dataScope) {
  await assertLogicalUnitIsLevel1ForWrite(dataScope.logicalUnitId);
}
```

- [ ] **Step 2: Call before mutate** in:
  - `createCommodity`, `patchCommodity`, `deleteCommodity` (và soft-deactivate nếu có)
  - `createPriceTable` / `upsert` / `patch` / `delete` price table paths
  - **Không** gọi trên list/get/resolve giá

Search markers in file: `async function createCommodity`, `async function patchCommodity`, `async function deleteCommodity`, price-table create/update/delete.

- [ ] **Step 3: Commit**

```bash
git add quanluong-app-be/src/modules/lttp/lttp.service.js
git commit -m "feat(lttp): only level-1 may write shared LTTP data"
```

---

### Task 4: Job titles → data-scope storage L1 + write guard

**Files:**
- Modify: `quanluong-app-be/src/modules/job-titles/job-titles.routes.js`
- Modify: `quanluong-app-be/src/modules/job-titles/job-titles.controller.js`
- Modify: `quanluong-app-be/src/modules/job-titles/job-titles.service.js`
- Modify: `quanluong-app-be/src/modules/job-titles/job-titles.validator.js` (ensure list query `unitId` nếu cần)

**Problem:** L2 user scope = subtree `[L2]` → list theo `entityUnitIdWhere` sẽ trống sau cleanup. Phải list theo `storageUnitId` cấp 1.

- [ ] **Step 1: Add middleware** on job-titles router (after effectiveUnitScope):

```javascript
import { unitDataScopeMiddleware } from "../../middlewares/unit-data-scope.middleware.js";
import { DATA_SCOPE_KINDS } from "../../shared/data-scope/data-scope.registry.js";

const jobTitleDataScopeMw = unitDataScopeMiddleware({
  dataKind: DATA_SCOPE_KINDS.JOB_TITLE.code,
});
// apply per-route or router.use(jobTitleDataScopeMw) for all CRUD
```

Ensure create/list body/query include `unitId` the same way LTTP does (logical unit). If list currently has no `unitId`, add optional query `unitId` defaulting via header/`user.unitId` (middleware already resolves logical).

- [ ] **Step 2: Change service**

```javascript
import { assertLogicalUnitIsLevel1ForWrite } from "../../shared/units/unit-level.helpers.js";

async function listJobTitles(scope, effectiveUnitIds, dataScope) {
  assertUnitIdInScope(dataScope.logicalUnitId, scope);
  // effective branch check like LTTP
  return prisma.jobTitle.findMany({
    where: { unitId: dataScope.storageUnitId },
    include: JOB_TITLE_INCLUDE,
    orderBy: [{ name: "asc" }],
  });
}

async function createJobTitle(payload, scope, effectiveUnitIds, dataScope) {
  // assert logical matches payload.unitId if present
  await assertLogicalUnitIsLevel1ForWrite(dataScope.logicalUnitId);
  // create with unitId: dataScope.storageUnitId
}
```

Same write guard on `patchJobTitle`, `deleteJobTitle`, `setJobTitlePermissions`.

- [ ] **Step 3: Wire controllers** to pass `req.dataScope`

- [ ] **Step 4: Commit**

```bash
git add quanluong-app-be/src/modules/job-titles/
git commit -m "feat(job-titles): share level-1 storage; L2 read-only"
```

---

### Task 5: Xóa API / permission apply-down (đồng bộ)

**Files:**
- Modify: `quanluong-app-be/src/modules/job-titles/job-titles.routes.js`
- Modify: `quanluong-app-be/src/modules/job-titles/job-titles.controller.js`
- Modify: `quanluong-app-be/src/modules/job-titles/job-titles.service.js` — remove `applyJobTitleToDescendantUnit`
- Modify: `quanluong-app-be/src/modules/job-titles/job-titles.route-definitions.js`
- Modify: `quanluong-app-be/src/modules/job-titles/job-titles.validator.js`
- Modify: `quanluong-app-be/src/modules/lttp/lttp.routes.js`
- Modify: `quanluong-app-be/src/modules/lttp/lttp.controller.js`
- Modify: `quanluong-app-be/src/modules/lttp/lttp.service.js` — remove apply* functions
- Modify: `quanluong-app-be/src/modules/lttp/lttp.route-definitions.js`
- Modify: `quanluong-app-be/src/modules/lttp/lttp.validator.js`
- Modify: `quanluong-app-be/src/modules/lttp/lttp.constants.js`
- Modify: `quanluong-app-be/src/shared/constants/permissions.js`
- Modify: `quanluong-app-be/src/shared/constants/permission-catalog.vi.js`
- Modify: `packages/shared/src/features/permissions/constants/permissions.js`
- Remove FE mutation hooks callers later in Task 6; also delete unused API hooks if present in `*Api.js`

- [ ] **Step 1: Delete routes** `POST .../apply-to-unit` from job-titles + lttp routers and route-definitions keys:
  - `applyJobTitleToUnit`
  - `applyLttpCommodityToUnit`
  - `applyLttpPriceTableToUnit`

- [ ] **Step 2: Remove permission codes**
  - `jobTitles.applyDown`
  - `lttp.commodities.applyDown`
  - `lttp.prices.applyDown`
  from BE + shared permission constants and VI catalog

- [ ] **Step 3: Run permission sync** (after deploy or locally):

Run: `cd quanluong-app-be && npm run sync:permissions`

Expected: applyDown permissions removed/updated in DB

- [ ] **Step 4: Commit**

```bash
git add quanluong-app-be/src/modules/job-titles quanluong-app-be/src/modules/lttp \
  quanluong-app-be/src/shared/constants packages/shared/src/features/permissions
git commit -m "refactor: remove unit apply-down sync APIs and permissions"
```

---

### Task 6: Xóa UI dashboard «Đồng bộ đơn vị con»

**Files:**
- Modify: `packages/shared/src/pages/dashboard/dashboardTabMeta.js`
- Modify: `packages/shared/src/pages/dashboard/DashboardTabPages.jsx`
- Modify: `packages/shared/src/features/route-access/routeAccessRegistry.js`
- Delete: `apps/web/app/(private)/dashboard/unit-downstream-sync/page.jsx`
- Delete: `packages/shared/src/pages/dashboard/admin/AdminUnitDataSharePanel.jsx` (if unused elsewhere)
- Modify: `packages/shared/src/pages/dashboard/admin/AdminLttpPanel.jsx` — remove copy pointing at sync tab
- Grep + remove: `useApplyJobTitleToUnitMutation`, `useApplyLttpCommodityToUnitMutation`, `useApplyLttpPriceTableToUnitMutation` from API modules

- [ ] **Step 1: Grep callers**

Run: `rg -n "unit-downstream-sync|AdminUnitDataSharePanel|ApplyJobTitleToUnit|ApplyLttpCommodityToUnit|ApplyLttpPriceTableToUnit" packages apps`

- [ ] **Step 2: Remove tab meta entry, page, panel, registry key, help copy, dead hooks**

- [ ] **Step 3: Commit**

```bash
git add packages/shared apps/web
git commit -m "refactor(ui): remove dashboard child-unit sync tab"
```

---

### Task 7: Admin chỉ ở đơn vị cấp 1

**Files:**
- Modify: `quanluong-app-be/src/modules/users/users.service.js`
- Modify: `packages/shared/src/pages/dashboard/superadmin/SuperadminUsersPanel.jsx` (và panel tạo user admin khác nếu có)

- [ ] **Step 1: Add assert in create/patch/replace**

```javascript
async function assertAdminOnlyOnLevel1(typeId, unitId) {
  if (unitId == null) return;
  const type = await prisma.type.findUnique({ where: { id: typeId } });
  if (!type || type.name !== ADMIN_TYPE_NAME) return;
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { depth: true },
  });
  if (!unit || unit.depth !== 0) {
    throw new AppError({
      message: "Chỉ đơn vị cấp 1 được gán tài khoản admin",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}
```

Call with resolved `typeId` + `resolvedUnitId` in `createUser`, `patchUser`, `replaceUser` whenever type or unit changes.

- [ ] **Step 2: FE** — khi selected unit `depth !== 0`, filter types list bỏ `admin` (hoặc disable option)

- [ ] **Step 3: Commit**

```bash
git add quanluong-app-be/src/modules/users/users.service.js \
  packages/shared/src/pages/dashboard/superadmin/SuperadminUsersPanel.jsx
git commit -m "feat(users): allow admin type only on level-1 units"
```

---

### Task 8: FE parent picker chỉ cấp 1

**Files:**
- Modify: `packages/shared/src/pages/dashboard/superadmin/SuperadminUnitsPanel.jsx`

- [ ] **Step 1: Filter parent options**

```javascript
const parentOptionsForCreate = sorted.filter((u) => (u.depth ?? 0) === 0);
const parentOptionsForEdit = sorted.filter(
  (u) => u.id !== editId && (u.depth ?? 0) === 0,
);
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/pages/dashboard/superadmin/SuperadminUnitsPanel.jsx
git commit -m "fix(ui): only level-1 units can be parents"
```

---

### Task 9: Script cleanup — flatten + xóa 3 loại cấp con

**Files:**
- Create: `quanluong-app-be/scripts/cleanup-level2-shared-kinds.js`
- Optional: add npm script in `quanluong-app-be/package.json`: `"db:cleanup-level2-shared": "node scripts/cleanup-level2-shared-kinds.js"`

**Behavior (no migrate):**

1. Flatten: every unit with `depth >= 2` → `parentId =` nearest depth-0 ancestor; then `rebuildAllUnitPaths()`
2. Collect unit ids where `depth >= 1`
3. For those units, in transaction(s):
   - Delete `UnitEntityFork` where kind in JOB_TITLE / LTTP_COMMODITY / LTTP_PRICE_TABLE and (source|target) in child units
   - Delete `UnitPrivateDataShareGrant` for those kinds involving child units
   - `JobTitle`: clear depends then `deleteMany({ unitId: { in: childIds } })`
   - `LttpPriceTable`: `deleteMany` (rows cascade)
   - Before commodities: delete Restrict dependents that reference commodities of child units:
     - `LttpIssueSlipLine` where commodity.unitId in childIds
     - `KitchenDishCatalogLine`, `KitchenMenuDishLine`, `KitchenReceiptSlipLine` same
     - `LttpPriceRow` / partner rows if any remain
     - `LttpCommodityDefaultSupplier` cascades with commodity
   - `LttpCommodity`: `deleteMany({ unitId: { in: childIds } })`
4. Print report: counts deleted; list admin users still on depth>=1 units (do not auto-demote)

- [ ] **Step 1: Implement script with `--dry-run` flag** (default dry-run; require `--execute` to write)

```javascript
const execute = process.argv.includes("--execute");
// log planned deletes; if execute, run transactions
```

- [ ] **Step 2: Dry-run against local DB**

Run: `cd quanluong-app-be && node scripts/cleanup-level2-shared-kinds.js`

Expected: summary printed, no writes

- [ ] **Step 3: Execute when ready**

Run: `node scripts/cleanup-level2-shared-kinds.js --execute`

- [ ] **Step 4: Commit**

```bash
git add quanluong-app-be/scripts/cleanup-level2-shared-kinds.js quanluong-app-be/package.json
git commit -m "chore(db): script to delete level-2 shared-kind data"
```

---

### Task 10: Acceptance checklist (manual)

- [ ] Create unit under a depth-1 parent → **400** max depth
- [ ] L1 user CRUD commodity/price/job title → OK, `unitId` = L1
- [ ] L2 user list same data → OK; create → **403**
- [ ] Dashboard tab sync gone; apply-to-unit → **404**
- [ ] Create admin on L2 → **400**; on L1 → OK
- [ ] After `--execute` cleanup: no commodity/jobTitle/priceTable with `unit.depth >= 1`

- [ ] **Commit docs if checklist notes added** (optional)

```bash
git status
```

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| Max depth 2 | 1, 8 |
| Storage luôn cấp 1 cho 3 kind | 2, 4 |
| L2 chỉ đọc | 3, 4 |
| Bỏ sync UI + API | 5, 6 |
| Xóa dữ liệu cấp con (không migrate) | 9 |
| Admin chỉ cấp 1 | 7 |
| Flatten cây sâu | 9 |
| Acceptance | 10 |

## Out of scope (do not implement)

- Soft-delete units
- Auto-demote existing L2 admins
- Drop `UnitEntityFork` table
- Change meal roster / chứng từ / kitchen scope models beyond FK cleanup for deleted commodities
