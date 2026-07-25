# Kitchen Menu Sample (Thực đơn mẫu AI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đổi tab **Thực đơn chi tiết** thành form nhập **thực đơn mẫu** (một buổi + mức tiền ăn + món/LTTP), lưu `KitchenMenuSample`, index vector stub, và cho phép áp dụng mẫu sang sổ thực đơn theo ngày.

**Architecture:** Một bảng Prisma `KitchenMenuSample` (món/LTTP trong `dishesJson`). CRUD + apply trong kitchen-books module; apply tái dùng `putMenuPeriod`. Qdrant: fire-and-forget upsert stub theo `sampleId`. FE: viết lại `KitchenMenuTab` — bỏ ngày/quân số; chọn buổi + mức từ meal-roster meta; danh sách mẫu + dialog áp dụng ngày.

**Tech Stack:** Prisma/MySQL, Express kitchen-books, Zod, React + TanStack Query, `node:test`.

**Spec:** `docs/superpowers/specs/2026-07-25-kitchen-menu-sample-design.md`

## Global Constraints

- Permission: chỉ `kitchenBooks.access` (reuse code hiện có).
- Mức tiền ăn: `MealAllowanceRate.type = an_tieu_chuan` và nằm trong `UnitSelectedMealRate` của đơn vị; **không** cho sửa `mucTienAn` trên UI.
- Không lưu ngày / quân số / giá LTTP trên mẫu.
- `mucTienAn` trong response/vector luôn đọc từ DB, không tin FE.
- Vector: DB nguồn chính; lỗi Qdrant nuốt, không chặn lưu.
- YAGNI: không chat AI, không kế hoạch tuần, không embedding/search thật, không backfill.
- Reuse: `validateLinePayload` (catalog), `putMenuPeriod` (menu), `useGetMealRosterMetaQuery` (rates đơn vị).

## File map

| File | Role |
|------|------|
| `quanluong-app-be/prisma/schema.prisma` | Model `KitchenMenuSample` + relations |
| `quanluong-app-be/prisma/migrations/20260725100000_kitchen_menu_sample/migration.sql` | Migration |
| `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-sample-normalize.js` | Pure normalize/validate shape of dishesJson |
| `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-sample-normalize.test.js` | Unit tests |
| `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai-vector.js` | Thêm stub upsert/search sample |
| `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai-vector.test.js` | Extend tests |
| `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-sample.service.js` | CRUD + apply |
| `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-sample.service.test.js` | Pure helpers: willOverwrite / apply payload |
| `quanluong-app-be/src/modules/meal-roster/meal-roster.service.js` | Export `assertStandardMealRateForUnit` |
| `quanluong-app-be/src/modules/kitchen-books/kitchen-books.validator.js` | Zod schemas samples |
| `quanluong-app-be/src/modules/kitchen-books/kitchen-books.route-definitions.js` | 5 route defs |
| `quanluong-app-be/src/modules/kitchen-books/kitchen-books.controller.js` | Controllers |
| `quanluong-app-be/src/modules/kitchen-books/kitchen-books.routes.js` | Wire routes |
| `packages/shared/src/app/query/queryKeys.js` | `menuSamples` key |
| `packages/shared/src/features/kitchen-books/api/kitchenBooksApi.js` | Query + mutations |
| `packages/shared/src/pages/kitchen-books/KitchenMenuTab.jsx` | Form mẫu (rewrite) |
| `packages/shared/src/pages/kitchen-books/KitchenMenuSampleApplyDialog.jsx` | Áp dụng vào ngày |
| `docs/superpowers/specs/2026-07-24-kitchen-menu-detail-design.md` | Align với vai trò mới |
| `docs/superpowers/specs/2026-07-24-kitchen-menu-ai-qdrant-addendum.md` | Ghi sample points |

---

### Task 1: Prisma `KitchenMenuSample`

**Files:**
- Modify: `quanluong-app-be/prisma/schema.prisma` (sau block `KitchenMenuDishLine`, thêm model; cập nhật `User`, `Unit`, `MealAllowanceRate`)
- Create: `quanluong-app-be/prisma/migrations/20260725100000_kitchen_menu_sample/migration.sql`

**Interfaces:**
- Produces: model `KitchenMenuSample` với fields theo spec.

- [ ] **Step 1: Thêm model vào schema**

Sau `KitchenMenuDishLine`, thêm:

```prisma
model KitchenMenuSample {
  id                   Int                   @id @default(autoincrement())
  unitId               Int
  mealPeriod           KitchenMenuMealPeriod
  mealAllowanceRateId  Int
  dishesJson           Json
  createdById          Int
  createdAt            DateTime              @default(now())
  updatedAt            DateTime              @updatedAt
  unit                 Unit                  @relation(fields: [unitId], references: [id], onDelete: Cascade)
  mealAllowanceRate    MealAllowanceRate     @relation(fields: [mealAllowanceRateId], references: [id], onDelete: Restrict)
  createdBy            User                  @relation("KitchenMenuSampleCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)

  @@index([unitId, mealPeriod])
  @@index([mealAllowanceRateId])
  @@index([createdById])
}
```

Trên `User` thêm:
`kitchenMenuSamplesCreated KitchenMenuSample[] @relation("KitchenMenuSampleCreatedBy")`

Trên `Unit` thêm:
`kitchenMenuSamples KitchenMenuSample[]`

Trên `MealAllowanceRate` thêm relation `kitchenMenuSamples KitchenMenuSample[]` (kiểm tra model đã có các relation khác rồi append).

- [ ] **Step 2: Viết migration SQL**

```sql
CREATE TABLE `KitchenMenuSample` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `mealPeriod` ENUM('sang', 'trua', 'chieu') NOT NULL,
    `mealAllowanceRateId` INTEGER NOT NULL,
    `dishesJson` JSON NOT NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KitchenMenuSample_unitId_mealPeriod_idx`(`unitId`, `mealPeriod`),
    INDEX `KitchenMenuSample_mealAllowanceRateId_idx`(`mealAllowanceRateId`),
    INDEX `KitchenMenuSample_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `KitchenMenuSample` ADD CONSTRAINT `KitchenMenuSample_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `KitchenMenuSample` ADD CONSTRAINT `KitchenMenuSample_mealAllowanceRateId_fkey` FOREIGN KEY (`mealAllowanceRateId`) REFERENCES `MealAllowanceRate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `KitchenMenuSample` ADD CONSTRAINT `KitchenMenuSample_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 3: Generate client**

```bash
cd quanluong-app-be && npx prisma generate
```

Expected: success, no schema errors.

- [ ] **Step 4: Commit**

```bash
git add quanluong-app-be/prisma/schema.prisma quanluong-app-be/prisma/migrations/20260725100000_kitchen_menu_sample/
git commit -m "$(cat <<'EOF'
feat(kitchen-books): add KitchenMenuSample table for AI training menus

EOF
)"
```

---

### Task 2: Normalize dishesJson + vector sample stub

**Files:**
- Create: `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-sample-normalize.js`
- Create: `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-sample-normalize.test.js`
- Modify: `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai-vector.js`
- Modify: `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai-vector.test.js`

**Interfaces:**
- Produces:
  - `normalizeSampleDishes(dishes: unknown): { name: string, sortOrder: number, lines: object[] }[]` — throw Error message tiếng Việt nếu rỗng / thiếu tên / thiếu dòng hợp lệ shape (không check commodity scope — service làm).
  - `formatSampleTextForVector(sample: { mealPeriod, mucTienAn, dishes }): string`
  - `buildSampleVectorPayload({ sampleId, unitId, mealPeriod, mealAllowanceRateId, mucTienAn, dishes }): object`
  - `upsertMenuSampleVector` / `scheduleMenuSampleVectorUpsert` (stub như menu day)

- [ ] **Step 1: Failing tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSampleDishes,
  formatSampleTextForVector,
  buildSampleVectorPayload,
} from "./kitchen-books-menu-sample-normalize.js";
import {
  isQdrantEnabled,
  scheduleMenuSampleVectorUpsert,
  upsertMenuSampleVector,
} from "./kitchen-books-menu-ai-vector.js";

test("normalize rejects empty dishes", () => {
  assert.throws(() => normalizeSampleDishes([]), /ít nhất một món/);
});

test("normalize keeps per_person line", () => {
  const out = normalizeSampleDishes([
    {
      name: " Canh  ",
      lines: [{ commodityId: 1, calcMode: "per_person", perPersonAmount: 50, perPersonUnit: "g" }],
    },
  ]);
  assert.equal(out[0].name, "Canh");
  assert.equal(out[0].lines[0].commodityId, 1);
});

test("formatSampleText includes period and rate", () => {
  const t = formatSampleTextForVector({
    mealPeriod: "trua",
    mucTienAn: 25000,
    dishes: [{ name: "Canh", lines: [{ commodityName: "Rau", calcMode: "per_person", perPersonAmount: 50, perPersonUnit: "g" }] }],
  });
  assert.match(t, /trua/);
  assert.match(t, /25000/);
  assert.match(t, /Canh/);
});

test("vector stub no-ops when disabled", async () => {
  delete process.env.QDRANT_URL;
  assert.equal(isQdrantEnabled(), false);
  const r = await upsertMenuSampleVector({ sampleId: 1 });
  assert.equal(r.skipped, true);
  scheduleMenuSampleVectorUpsert({ sampleId: 1 });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd quanluong-app-be && node --test src/modules/kitchen-books/kitchen-books-menu-sample-normalize.test.js
```

Expected: FAIL (module missing).

- [ ] **Step 3: Implement normalize + format + payload**

`normalizeSampleDishes`: trim names; require ≥1 dish; each dish name non-empty; each dish ≥1 line; each line needs `commodityId` + `calcMode`; mirror menu line rules (per_person ↔ amount+unit; per_unit_shared ↔ peoplePerUnit). Return plain JSON-serializable objects (numbers, not Decimal).

`formatSampleTextForVector` / `buildSampleVectorPayload`: compact text + `{ sampleId, unitId, mealPeriod, mealAllowanceRateId, mucTienAn, text }`.

- [ ] **Step 4: Extend vector module**

Thêm vào `kitchen-books-menu-ai-vector.js`:

```js
async function upsertMenuSampleVector(_payload) {
  if (!isQdrantEnabled()) {
    return { ok: true, skipped: true, reason: "qdrant_disabled" };
  }
  // ponytail: real embed later
  return { ok: true, skipped: true, reason: "scaffold_pending_embed" };
}

function scheduleMenuSampleVectorUpsert(payload) {
  setImmediate(() => {
    upsertMenuSampleVector(payload).catch(() => {});
  });
}
```

Export cả hai. Cập nhật test file vector hiện có nếu cần export mới.

- [ ] **Step 5: Run — expect PASS**

```bash
cd quanluong-app-be && node --test \
  src/modules/kitchen-books/kitchen-books-menu-sample-normalize.test.js \
  src/modules/kitchen-books/kitchen-books-menu-ai-vector.test.js
```

- [ ] **Step 6: Commit**

```bash
git add quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-sample-normalize.js \
  quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-sample-normalize.test.js \
  quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai-vector.js \
  quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-ai-vector.test.js
git commit -m "$(cat <<'EOF'
feat(kitchen-books): normalize menu samples and stub sample vectors

EOF
)"
```

---

### Task 3: Sample service (CRUD + apply)

**Files:**
- Create: `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-sample.service.js`
- Create: `quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-sample.service.test.js`
- Modify: `quanluong-app-be/src/modules/meal-roster/meal-roster.service.js` — export `assertStandardMealRateForUnit`

**Interfaces:**
- Consumes: `normalizeSampleDishes`, `validateLinePayload`, `putMenuPeriod`, `assertStandardMealRateForUnit`, `scheduleMenuSampleVectorUpsert`, kitchen scope helpers (cùng pattern `assertKitchenWriteUnit` / `assertKitchenLogicalMatchesDataScope`)
- Produces:
  - `listMenuSamples({ unitId, mealPeriod?, rateId? }, scope, effectiveUnitIds, dataScope)`
  - `createMenuSample(payload, userId, scope, effectiveUnitIds, dataScope)`
  - `updateMenuSample(id, payload, userId, scope, effectiveUnitIds, dataScope)`
  - `deleteMenuSample(id, unitId, scope, effectiveUnitIds, dataScope)`
  - `applyMenuSample(id, { date, confirmOverwrite? }, scope, effectiveUnitIds, dataScope)` → `{ applied: false, willOverwrite: true }` | `{ applied: true, menu }`
  - `periodHasDishes(menuDayPeriods, mealPeriod): boolean` (export for test)

- [ ] **Step 1: Export rate assert từ meal-roster**

Trong `meal-roster.service.js`, đổi tên logic hiện có:

```js
async function assertStandardMealRateForUnit(unitId, rateId) {
  await assertMealAllowanceRateIdForUnit(unitId, rateId);
  const r = await prisma.mealAllowanceRate.findUnique({
    where: { id: rateId },
    select: { type: true },
  });
  if (r?.type !== "an_tieu_chuan") {
    throw new AppError({
      message: "Chỉ dùng mức «ăn tiêu chuẩn» đã chọn cho đơn vị",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

async function assertStandardMealRateForGuaranty(unitId, rateId) {
  await assertStandardMealRateForUnit(unitId, rateId);
}
```

Thêm `assertStandardMealRateForUnit` vào `export { ... }`.

- [ ] **Step 2: Failing tests cho apply helpers**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { periodHasDishes, dishesJsonToPutMenuDishes } from "./kitchen-books-menu-sample.service.js";

test("periodHasDishes true when dishes exist", () => {
  assert.equal(periodHasDishes({ trua: { dishes: [{ name: "A" }] } }, "trua"), true);
  assert.equal(periodHasDishes({ trua: { dishes: [] } }, "trua"), false);
});

test("dishesJsonToPutMenuDishes maps fields", () => {
  const dishes = dishesJsonToPutMenuDishes([
    { name: "A", sortOrder: 0, lines: [{ commodityId: 1, calcMode: "per_person", perPersonAmount: 10, perPersonUnit: "g" }] },
  ]);
  assert.equal(dishes[0].name, "A");
  assert.equal(dishes[0].lines[0].commodityId, 1);
});
```

- [ ] **Step 3: Implement service**

Skeleton:

```js
async function validateSampleDishesAgainstScope(dishes, storageUnitId) {
  const normalized = normalizeSampleDishes(dishes);
  for (const dish of normalized) {
    for (const line of dish.lines) {
      await validateLinePayload(line, storageUnitId);
    }
  }
  return normalized;
}

function serializeSample(row) {
  return {
    id: row.id,
    unitId: row.unitId,
    mealPeriod: row.mealPeriod,
    mealAllowanceRateId: row.mealAllowanceRateId,
    mucTienAn: row.mealAllowanceRate?.mucTienAn ?? null,
    doiTuong: row.mealAllowanceRate?.doiTuong ?? null,
    dishes: row.dishesJson,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function applyMenuSample(id, body, scope, effectiveUnitIds, dataScope) {
  const sample = await getSampleOrThrow(id, body.unitId ?? /* from sample after load */, ...);
  // load sample by id; assert write unit; storage from dataScope
  const menuPreview = await getMenuDay({ unitId: sample.unitId, date: body.date }, scope, effectiveUnitIds, dataScope);
  const has = periodHasDishes(menuPreview.periods, sample.mealPeriod);
  if (has && !body.confirmOverwrite) {
    return { applied: false, willOverwrite: true };
  }
  const menu = await putMenuPeriod(
    {
      unitId: sample.unitId,
      date: body.date,
      mealPeriod: sample.mealPeriod,
      dishes: dishesJsonToPutMenuDishes(sample.dishesJson),
    },
    scope,
    effectiveUnitIds,
    dataScope,
  );
  return { applied: true, willOverwrite: has, menu };
}
```

Sau create/update: `scheduleMenuSampleVectorUpsert(buildSampleVectorPayload(...))` — load commodity names optional; nếu chưa có tên thì text chỉ có tên món + commodityId (đủ stub).

`listMenuSamples`: `where: { unitId: storageUnitId, mealPeriod?, mealAllowanceRateId: rateId? }`, include rate, orderBy `updatedAt desc`, limit 100.

`create`/`update`: gọi `assertStandardMealRateForUnit(storageUnitId, rateId)` rồi `validateSampleDishesAgainstScope`.

- [ ] **Step 4: Run tests**

```bash
cd quanluong-app-be && node --test src/modules/kitchen-books/kitchen-books-menu-sample.service.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-sample.service.js \
  quanluong-app-be/src/modules/kitchen-books/kitchen-books-menu-sample.service.test.js \
  quanluong-app-be/src/modules/meal-roster/meal-roster.service.js
git commit -m "$(cat <<'EOF'
feat(kitchen-books): add menu sample CRUD and apply-to-day service

EOF
)"
```

---

### Task 4: Validator + routes + controller

**Files:**
- Modify: `quanluong-app-be/src/modules/kitchen-books/kitchen-books.validator.js`
- Modify: `quanluong-app-be/src/modules/kitchen-books/kitchen-books.route-definitions.js`
- Modify: `quanluong-app-be/src/modules/kitchen-books/kitchen-books.controller.js`
- Modify: `quanluong-app-be/src/modules/kitchen-books/kitchen-books.routes.js`

**Interfaces:**
- Consumes: service functions Task 3
- Produces: HTTP endpoints theo spec

- [ ] **Step 1: Zod schemas**

Reuse `dishInputSchema` / `lineInputSchema` nếu đã export; nếu chưa, dùng lại cùng shape. Thêm:

```js
const menuSamplesListQuerySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  mealPeriod: mealPeriodSchema.optional(),
  rateId: z.coerce.number().int().positive().optional(),
});

const menuSampleBodySchema = z.object({
  unitId: z.coerce.number().int().positive(),
  mealPeriod: mealPeriodSchema,
  rateId: z.coerce.number().int().positive(),
  dishes: z.array(dishInputSchema).min(1),
});

const menuSampleIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const applyMenuSampleBodySchema = z.object({
  date: dateSchema,
  confirmOverwrite: z.boolean().optional(),
});
```

Export tất cả. `put` body = `menuSampleBodySchema` (unitId bắt buộc để scope).

- [ ] **Step 2: Route definitions**

Thêm 5 entries, permission `PERMISSIONS.KITCHEN_BOOKS_ACCESS`:

| key | method | path |
|-----|--------|------|
| listKitchenMenuSamples | GET | `/menu-samples` |
| createKitchenMenuSample | POST | `/menu-samples` |
| updateKitchenMenuSample | PUT | `/menu-samples/:id` |
| deleteKitchenMenuSample | DELETE | `/menu-samples/:id` |
| applyKitchenMenuSample | POST | `/menu-samples/:id/apply` |

Mô tả tiếng Việt ngắn trong `permission.description` (cùng code access — không cần entry catalog mới).

- [ ] **Step 3: Controllers**

```js
async function listMenuSamplesController(req, res) {
  const data = await listMenuSamples(req.validatedQuery, req.unitScope, req.effectiveUnitIds, req.dataScope);
  return respondSuccess(res, { message: "Đã tải thực đơn mẫu", data });
}
// create → respondCreated; update/delete/apply → respondSuccess
// apply: pass req.user.id không cần; createdBy chỉ create
// create: createdById = req.user.id
```

Wire `req.validatedBody` / params / query như các controller menu khác.

- [ ] **Step 4: Routes**

Đăng ký **trước** các route `/:id` generic nếu có xung đột. Pattern:

```js
kitchenBooksRouter.get(
  "/menu-samples",
  dataScopeMw,
  permissionMiddleware(routePermissions.listKitchenMenuSamples),
  validateRequest({ query: menuSamplesListQuerySchema }),
  asyncHandler(listMenuSamplesController),
);
// POST /, PUT /:id, DELETE /:id?unitId=, POST /:id/apply
```

DELETE query cần `unitId` (giống catalog delete).

- [ ] **Step 5: Smoke import**

```bash
cd quanluong-app-be && node -e "import('./src/modules/kitchen-books/kitchen-books.routes.js').then(() => console.log('ok'))"
```

Expected: `ok`.

- [ ] **Step 6: Commit**

```bash
git add quanluong-app-be/src/modules/kitchen-books/kitchen-books.validator.js \
  quanluong-app-be/src/modules/kitchen-books/kitchen-books.route-definitions.js \
  quanluong-app-be/src/modules/kitchen-books/kitchen-books.controller.js \
  quanluong-app-be/src/modules/kitchen-books/kitchen-books.routes.js
git commit -m "$(cat <<'EOF'
feat(kitchen-books): expose menu-samples API routes

EOF
)"
```

---

### Task 5: FE API hooks

**Files:**
- Modify: `packages/shared/src/app/query/queryKeys.js`
- Modify: `packages/shared/src/features/kitchen-books/api/kitchenBooksApi.js`

**Interfaces:**
- Produces:
  - `qk.kitchenBooks.menuSamples(unitId, mealPeriod, rateId)`
  - `useGetKitchenMenuSamplesQuery`
  - `useCreateKitchenMenuSampleMutation`
  - `useUpdateKitchenMenuSampleMutation`
  - `useDeleteKitchenMenuSampleMutation`
  - `useApplyKitchenMenuSampleMutation`

- [ ] **Step 1: Query key**

```js
menuSamples: (unitId, mealPeriod, rateId) => [
  "kitchenBooks",
  "menuSamples",
  String(unitId),
  mealPeriod ?? "",
  rateId != null ? String(rateId) : "",
],
```

- [ ] **Step 2: Hooks**

```js
export function useGetKitchenMenuSamplesQuery(arg, options = {}) {
  const { unitId, mealPeriod, rateId } = arg || {};
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: qk.kitchenBooks.menuSamples(unitId, mealPeriod, rateId),
    queryFn: () =>
      apiRequest({
        url: "/kitchen-books/menu-samples",
        method: "get",
        params: {
          unitId,
          mealPeriod: mealPeriod || undefined,
          rateId: rateId || undefined,
        },
      }),
    enabled: skip !== true && unitId != null,
    ...rest,
  });
}
```

Mutations invalidate `qk.kitchenBooks.menuSamples` root prefix (`qc.invalidateQueries({ queryKey: ["kitchenBooks", "menuSamples"] })`). Apply success cũng invalidate `menu` + `menuDetail` + `monthMarkers` cho `date` nếu có.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/app/query/queryKeys.js \
  packages/shared/src/features/kitchen-books/api/kitchenBooksApi.js
git commit -m "$(cat <<'EOF'
feat(kitchen-books): add menu-samples TanStack Query hooks

EOF
)"
```

---

### Task 6: Rewrite `KitchenMenuTab` — form mẫu

**Files:**
- Modify: `packages/shared/src/pages/kitchen-books/KitchenMenuTab.jsx` (rewrite UX; giữ tên export)
- Modify: `packages/shared/src/pages/kitchen-books/kitchenBooksSessionPersist.js` — persist `mealPeriod` + `rateId` (bỏ amountPerPerson nếu có)

**Interfaces:**
- Consumes: hooks Task 5, `useGetMealRosterMetaQuery`, catalog picker, commodity picker
- Produces: UI theo spec phần UI

- [ ] **Step 1: Gỡ ngày / quân số / AI suggest / amount editable**

Xóa: date chevron, month markers, headcount banner, `amountPerPerson` input, `useSuggestKitchenMenuAiMutation` + AI dialog wiring (AI gợi ý ngày thuộc sổ thực đơn / phase sau — không trên form mẫu).

Giữ: UnitPicker, period toggles, dish cards, commodity lines, add/remove dish/line, pick from catalog (import vào **draft** local, không gọi import-to-menu-day).

- [ ] **Step 2: Rates từ meal-roster meta**

```js
const { data: mealMeta } = useGetMealRosterMetaQuery(
  { unitId: selectedUnitId },
  { skip: !canAccess || !selectedUnitId },
);
const rateList = mealMeta?.rates ?? [];
```

Select mức: chỉ `rateId`; hiển thị `formatMealAmountOnly(r.mucTienAn) đ/người` — **không** ô sửa số. Nếu `needsMealRateSelection`, hiện hướng dẫn mở Sổ chấm cơm chọn mức.

- [ ] **Step 3: Lưu mẫu**

Nút **Lưu mẫu**:
- nếu đang edit (`editingSampleId`) → `updateSample({ id, unitId, mealPeriod, rateId, dishes })`
- else → `createSample(...)`
- dirty warning khi đổi buổi/mức/đơn vị
- sau lưu: `notifySuccess` kèm số mẫu (`samples.length`), reset dirty, giữ form hoặc clear theo UX «lưu xong vẫn mở để tạo tiếp» — **clear dishes về empty + giữ buổi/mức** (dễ nhập nhiều mẫu).

- [ ] **Step 4: Empty state**

Khi `draftDishes.length === 0`: 3 bước ngắn + nút «Chọn từ danh mục» / «Thêm món».

Cảnh báo viền: món `!name.trim()` hoặc line `!commodityId` → `ring-amber-500/50`.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/pages/kitchen-books/KitchenMenuTab.jsx \
  packages/shared/src/pages/kitchen-books/kitchenBooksSessionPersist.js
git commit -m "$(cat <<'EOF'
feat(kitchen-books): make menu detail tab a sample entry form

EOF
)"
```

---

### Task 7: Danh sách mẫu + apply dialog

**Files:**
- Create: `packages/shared/src/pages/kitchen-books/KitchenMenuSampleApplyDialog.jsx`
- Modify: `packages/shared/src/pages/kitchen-books/KitchenMenuTab.jsx`

**Interfaces:**
- Consumes: list/update/delete/apply mutations
- Produces: list dưới form; dialog chọn ngày

- [ ] **Step 1: List dưới form**

`useGetKitchenMenuSamplesQuery({ unitId, mealPeriod, rateId })` — lọc đúng buổi+mức đang chọn.

Mỗi hàng: tóm tắt tên món (join `, `), mức đ/người, nút **Sửa** (load dishes vào draft + set `editingSampleId`), **Áp dụng**, **Xóa** (confirm).

- [ ] **Step 2: Apply dialog**

```jsx
export function KitchenMenuSampleApplyDialog({ open, onClose, sample, unitId }) {
  // date input; show sample.mealPeriod label (read-only)
  // onSubmit: apply({ id: sample.id, date, confirmOverwrite: false })
  // if data.willOverwrite && !data.applied → confirm() rồi apply lại với confirmOverwrite: true
}
```

- [ ] **Step 3: Manual check list (dev)**

1. Migrate DB / restart BE.
2. Mở Thực đơn chi tiết → chọn đơn vị, buổi Trưa, mức 25k → thêm món/LTTP → Lưu mẫu.
3. Thấy mẫu trong list; Sửa / Xóa OK.
4. Áp dụng vào ngày trống → Sổ thực đơn có món.
5. Áp dụng lại → hỏi ghi đè.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/pages/kitchen-books/KitchenMenuSampleApplyDialog.jsx \
  packages/shared/src/pages/kitchen-books/KitchenMenuTab.jsx
git commit -m "$(cat <<'EOF'
feat(kitchen-books): list samples and apply them to a menu day

EOF
)"
```

---

### Task 8: Align related specs

**Files:**
- Modify: `docs/superpowers/specs/2026-07-24-kitchen-menu-detail-design.md`
- Modify: `docs/superpowers/specs/2026-07-24-kitchen-menu-ai-qdrant-addendum.md`

- [ ] **Step 1: Menu detail design**

Ghi rõ: tab Thực đơn chi tiết = form **mẫu** (xem spec 2026-07-25); tab Sổ thực đơn = view ngày + giá; API `/menu/detail` vẫn phục vụ tab Sổ thực đơn.

- [ ] **Step 2: Qdrant addendum**

Thêm: ngoài 1 point/ngày, có **1 point/mẫu** (`KitchenMenuSample`); collection có thể `kitchen_menu_samples` hoặc cùng collection với payload `kind=sample|day`.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-07-24-kitchen-menu-detail-design.md \
  docs/superpowers/specs/2026-07-24-kitchen-menu-ai-qdrant-addendum.md
git commit -m "$(cat <<'EOF'
docs: align kitchen menu specs with sample-training flow

EOF
)"
```

---

## Plan self-review

1. **Spec coverage:** UI (T6–T7), schema (T1), API (T3–T4), vector stub (T2), apply+overwrite (T3+T7), rate locked từ DB unit selection (T3+T6), no price kind / no date / no headcount (T6). OK.
2. **Placeholders:** none intentional.
3. **Types:** `rateId` body ↔ `mealAllowanceRateId` DB; apply `{ date, confirmOverwrite }` consistent FE/BE.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-25-kitchen-menu-sample.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
**2. Inline Execution** — run tasks in this session with checkpoints  

Which approach?
