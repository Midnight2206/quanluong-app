# Cổng nhà cung cấp LTTP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Superadmin gắn tài khoản `lttp_supplier` vào nhà cung cấp LTTP đã có, và tài khoản đó đăng nhập cổng chung rồi chỉ xem đặt hàng trong ngày của một cặp đơn vị cấp 1 + nhà cung cấp.

**Architecture:** Bảng `UserLttpSupplier` lưu các cặp. API nhà cung cấp chỉ nhận loại `lttp_supplier` và gọi lại `getDailyOrderSummary` với đơn vị kho của nhà cung cấp đó. App Next `apps/supplier` chỉ có `/dat-hang`. App chính phát hiện loại user và chuyển origin.

**Tech Stack:** Express, Prisma/MariaDB, Node `node:test`, React, Next.js app `apps/supplier`.

## Global Constraints

- Loại hệ thống `lttp_supplier`, `isSystem: true`. Không tự đăng ký. Không thêm mã quyền, không sửa `permission-catalog.vi.js`.
- Đơn vị cấp 1 là `Unit.depth === 0`.
- Một lần xem là một `supplierId`. Không gộp hai nhà cung cấp, kể cả cùng đơn vị cấp 1. Không gộp hai đơn vị cấp 1.
- `unitId`, `assignedUnitId`, `jobTitleId` của user loại này là null.
- Đăng nhập ở cổng app chính. Session loại này sang `{origin nhà cung cấp}/dat-hang` và bỏ `from`. Google đi cùng luật sau khi session có trên app chính.
- App `apps/supplier`. Dev `3002`. Production `8082`. `NEXT_PUBLIC_SUPPLIER_ORIGIN`. Không có trang đăng nhập riêng.
- `GET /api/lttp-supplier/links` và `GET /api/lttp-supplier/orders` chỉ loại `lttp_supplier`. Loại khác `403`.
- `supplierId` không thuộc tài khoản: `404`, câu `Không thấy nhà cung cấp của tài khoản này.`
- `GET /api/lttp-supplier/catalog` chỉ superadmin, phục vụ ô chọn trên màn user.
- Trang chỉ xem. Không sửa phiếu, không copy, không tải, không chia sẻ Zalo.
- Lọc đơn vị nhận trên trình duyệt. Mặc định chọn tất cả. Bỏ hết thì câu `Chọn ít nhất một đơn vị nhận.` Ngày không có dòng: `Không có đặt hàng trong ngày này.` Chưa gắn: `Superadmin chưa gắn nhà cung cấp.`
- Nhiều cặp thì chưa chọn chưa gọi orders. Tải lại trang thì chọn lại. Một cặp thì không hiện ô chọn.
- Không tạo lại container `quanluong-backup`.

---

### Task 1: Bảng gắn và luật nhà cung cấp cấp 1

**Files:**
- Create: `quanluong-app-be/src/modules/lttp-supplier/lttp-supplier.links.js`
- Create: `quanluong-app-be/src/modules/lttp-supplier/lttp-supplier.links.test.js`
- Create: `quanluong-app-be/prisma/migrations/20261008120000_user_lttp_supplier/migration.sql`
- Modify: `quanluong-app-be/prisma/schema.prisma`
- Modify: `quanluong-app-be/src/modules/auth/auth.service.js`

**Interfaces:**
- Consumes: không có.
- Produces:
  - `LTTP_SUPPLIER_TYPE_NAME = "lttp_supplier"`
  - `uniqueSupplierIds(ids: number[])` → `number[]`. Rỗng hoặc id không phải số nguyên dương thì `AppError` 400, câu `Chọn ít nhất một nhà cung cấp.` Id lặp chỉ giữ một lần, theo thứ tự gặp.
  - `replaceUserLttpSupplierLinks(userId: number, supplierIds: number[], db)` → xóa gắn cũ của user rồi tạo đúng tập id. Nhà cung cấp thiếu hoặc `unit.depth !== 0` thì `AppError` 400, câu `Nhà cung cấp không tồn tại hoặc không thuộc đơn vị cấp 1.` Không ghi DB khi lỗi.
  - `clearUserLttpSupplierLinks(userId: number, db)` → `deleteMany` theo `userId`.

- [ ] **Step 1: Write the failing test**

Tạo `quanluong-app-be/src/modules/lttp-supplier/lttp-supplier.links.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  LTTP_SUPPLIER_TYPE_NAME,
  clearUserLttpSupplierLinks,
  replaceUserLttpSupplierLinks,
  uniqueSupplierIds,
} from "./lttp-supplier.links.js";

test("uniqueSupplierIds keeps first occurrence", () => {
  assert.deepEqual(uniqueSupplierIds([2, 2, 1]), [2, 1]);
});

test("uniqueSupplierIds rejects empty", () => {
  assert.throws(() => uniqueSupplierIds([]), (err) => err.statusCode === 400 && err.message === "Chọn ít nhất một nhà cung cấp.");
});

function fakeDb(rows) {
  const calls = [];
  return {
    calls,
    lttpSupplier: {
      async findMany() {
        return rows;
      },
    },
    userLttpSupplier: {
      async deleteMany(args) {
        calls.push(["delete", args]);
      },
      async createMany(args) {
        calls.push(["create", args]);
      },
    },
  };
}

test("replace rejects a supplier outside level 1 and does not write", async () => {
  const db = fakeDb([{ id: 5, unit: { depth: 1 } }]);
  await assert.rejects(
    () => replaceUserLttpSupplierLinks(9, [5], db),
    (err) => err.statusCode === 400 && err.message === "Nhà cung cấp không tồn tại hoặc không thuộc đơn vị cấp 1.",
  );
  assert.equal(db.calls.length, 0);
});

test("replace rewrites the exact id set", async () => {
  const db = fakeDb([
    { id: 5, unit: { depth: 0 } },
    { id: 8, unit: { depth: 0 } },
  ]);
  await replaceUserLttpSupplierLinks(9, [5, 5, 8], db);
  assert.deepEqual(db.calls[0], ["delete", { where: { userId: 9 } }]);
  assert.deepEqual(db.calls[1], ["create", { data: [
    { userId: 9, lttpSupplierId: 5 },
    { userId: 9, lttpSupplierId: 8 },
  ] }]);
});

test("clear deletes by user", async () => {
  const db = fakeDb([]);
  await clearUserLttpSupplierLinks(4, db);
  assert.deepEqual(db.calls, [["delete", { where: { userId: 4 } }]]);
});

test("system type name is lttp_supplier and boot upserts it", () => {
  assert.equal(LTTP_SUPPLIER_TYPE_NAME, "lttp_supplier");
  const src = readFileSync(new URL("../auth/auth.service.js", import.meta.url), "utf8");
  assert.match(src, /LTTP_SUPPLIER:\s*"lttp_supplier"/);
  assert.match(src, /name: SYSTEM_TYPE_NAMES\.LTTP_SUPPLIER/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run từ `quanluong-app-be`:

```bash
node --test src/modules/lttp-supplier/lttp-supplier.links.test.js
```

Expected: FAIL, không import được module.

- [ ] **Step 3: Write minimal implementation**

Trong `quanluong-app-be/prisma/schema.prisma`, thêm vào `model User` (cạnh các quan hệ khác):

```prisma
  lttpSupplierLinks UserLttpSupplier[]
```

Thêm vào `model LttpSupplier` (cạnh các quan hệ khác):

```prisma
  userLinks UserLttpSupplier[]
```

Thêm model:

```prisma
model UserLttpSupplier {
  userId         Int
  lttpSupplierId Int
  createdAt      DateTime     @default(now())
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  lttpSupplier   LttpSupplier @relation(fields: [lttpSupplierId], references: [id], onDelete: Cascade)

  @@id([userId, lttpSupplierId])
  @@index([lttpSupplierId])
}
```

Tạo `quanluong-app-be/prisma/migrations/20261008120000_user_lttp_supplier/migration.sql`:

```sql
CREATE TABLE `UserLttpSupplier` (
  `userId` INTEGER NOT NULL,
  `lttpSupplierId` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `UserLttpSupplier_lttpSupplierId_idx`(`lttpSupplierId`),
  PRIMARY KEY (`userId`, `lttpSupplierId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `UserLttpSupplier`
  ADD CONSTRAINT `UserLttpSupplier_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `UserLttpSupplier_lttpSupplierId_fkey`
    FOREIGN KEY (`lttpSupplierId`) REFERENCES `LttpSupplier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
```

Tạo `quanluong-app-be/src/modules/lttp-supplier/lttp-supplier.links.js`:

```js
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

const LTTP_SUPPLIER_TYPE_NAME = "lttp_supplier";

function uniqueSupplierIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError({
      message: "Chọn ít nhất một nhà cung cấp.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const out = [];
  const seen = new Set();
  for (const raw of ids) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError({
        message: "Chọn ít nhất một nhà cung cấp.",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

async function replaceUserLttpSupplierLinks(userId, supplierIds, db) {
  const ids = uniqueSupplierIds(supplierIds);
  const rows = await db.lttpSupplier.findMany({
    where: { id: { in: ids } },
    select: { id: true, unit: { select: { depth: true } } },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const missingOrDeep = ids.some((id) => byId.get(id)?.unit?.depth !== 0);
  if (missingOrDeep) {
    throw new AppError({
      message: "Nhà cung cấp không tồn tại hoặc không thuộc đơn vị cấp 1.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  await db.userLttpSupplier.deleteMany({ where: { userId } });
  await db.userLttpSupplier.createMany({
    data: ids.map((lttpSupplierId) => ({ userId, lttpSupplierId })),
  });
}

async function clearUserLttpSupplierLinks(userId, db) {
  await db.userLttpSupplier.deleteMany({ where: { userId } });
}

export {
  LTTP_SUPPLIER_TYPE_NAME,
  clearUserLttpSupplierLinks,
  replaceUserLttpSupplierLinks,
  uniqueSupplierIds,
};
```

Trong `auth.service.js`, sửa hằng:

```js
const SYSTEM_TYPE_NAMES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  USER: "user",
  LTTP_SUPPLIER: "lttp_supplier",
};
```

Trong `ensureSystemTypes`, thêm upsert thứ tư vào `Promise.all` (cùng dạng `admin` / `user`):

```js
    prisma.type.upsert({
      where: { name: SYSTEM_TYPE_NAMES.LTTP_SUPPLIER },
      update: {
        isSystem: true,
        description: "Nhà cung cấp LTTP, chỉ xem đặt hàng của các nhà cung cấp được gắn.",
      },
      create: {
        name: SYSTEM_TYPE_NAMES.LTTP_SUPPLIER,
        isSystem: true,
        description: "Nhà cung cấp LTTP, chỉ xem đặt hàng của các nhà cung cấp được gắn.",
      },
    }),
```

Đổi destructuring thành bốn phần tử và trả `lttpSupplierType` cùng các type cũ. Không gán quyền cho loại này.

Chạy `npx prisma validate` và `npx prisma generate` trong `quanluong-app-be`.

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test src/modules/lttp-supplier/lttp-supplier.links.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/prisma/schema.prisma quanluong-app-be/prisma/migrations/20261008120000_user_lttp_supplier/migration.sql quanluong-app-be/src/modules/lttp-supplier/lttp-supplier.links.js quanluong-app-be/src/modules/lttp-supplier/lttp-supplier.links.test.js quanluong-app-be/src/modules/auth/auth.service.js
git commit -m "feat(lttp): link a supplier user to level-1 suppliers"
```

---

### Task 2: Tạo và sửa user gắn nhà cung cấp

**Files:**
- Modify: `quanluong-app-be/src/modules/users/users.validator.js`
- Modify: `quanluong-app-be/src/modules/users/users.service.js`
- Test: `quanluong-app-be/src/modules/lttp-supplier/lttp-supplier.assign.test.js`

**Interfaces:**
- Consumes: `LTTP_SUPPLIER_TYPE_NAME`, `replaceUserLttpSupplierLinks`, `clearUserLttpSupplierLinks` từ Task 1.
- Produces:
  - `syncLttpSupplierAssignment(userId, { nextTypeName, mode, supplierIds }, db)`
    - `mode` là `"create"`, `"replace"`, hoặc `"patch"`.
    - `nextTypeName !== "lttp_supplier"` thì `clearUserLttpSupplierLinks` và return.
    - Loại nhà cung cấp mà `supplierIds` là `undefined`: `create` và `replace` ném 400 `Chọn ít nhất một nhà cung cấp.`; `patch` giữ nguyên gắn.
    - Có `supplierIds` thì `replaceUserLttpSupplierLinks`.
  - `blankUnitFieldsForSupplier(typeName, fields)` → nếu `typeName === "lttp_supplier"` thì `{ ...fields, unitId: null, assignedUnitId: null, jobTitleId: null }`, còn lại trả `fields`.
  - Body user nhận `supplierIds?: number[]`.

- [ ] **Step 1: Write the failing test**

Tạo `quanluong-app-be/src/modules/lttp-supplier/lttp-supplier.assign.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { blankUnitFieldsForSupplier, syncLttpSupplierAssignment } from "./lttp-supplier.links.js";

test("blankUnitFieldsForSupplier clears unit fields", () => {
  assert.deepEqual(
    blankUnitFieldsForSupplier("lttp_supplier", { unitId: 3, assignedUnitId: 4, jobTitleId: 5, username: "a" }),
    { unitId: null, assignedUnitId: null, jobTitleId: null, username: "a" },
  );
  assert.deepEqual(blankUnitFieldsForSupplier("admin", { unitId: 3 }), { unitId: 3 });
});

test("sync on create requires supplier ids", async () => {
  const db = { calls: [] };
  await assert.rejects(
    () => syncLttpSupplierAssignment(1, { nextTypeName: "lttp_supplier", mode: "create", supplierIds: undefined }, db),
    (err) => err.statusCode === 400 && err.message === "Chọn ít nhất một nhà cung cấp.",
  );
});

test("sync on patch without supplierIds keeps links", async () => {
  const db = { calls: [] };
  await syncLttpSupplierAssignment(1, { nextTypeName: "lttp_supplier", mode: "patch", supplierIds: undefined }, db);
  assert.equal(db.calls.length, 0);
});

test("sync away from supplier clears links", async () => {
  const db = {
    calls: [],
    userLttpSupplier: {
      async deleteMany(args) {
        db.calls.push(args);
      },
    },
  };
  await syncLttpSupplierAssignment(7, { nextTypeName: "user", mode: "patch", supplierIds: [1] }, db);
  assert.deepEqual(db.calls, [{ where: { userId: 7 } }]);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test src/modules/lttp-supplier/lttp-supplier.assign.test.js
```

Expected: FAIL, `blankUnitFieldsForSupplier` chưa export.

- [ ] **Step 3: Write minimal implementation**

Thêm vào `lttp-supplier.links.js` và export:

```js
function blankUnitFieldsForSupplier(typeName, fields) {
  if (typeName !== LTTP_SUPPLIER_TYPE_NAME) {
    return fields;
  }
  return { ...fields, unitId: null, assignedUnitId: null, jobTitleId: null };
}

async function syncLttpSupplierAssignment(userId, { nextTypeName, mode, supplierIds }, db) {
  if (nextTypeName !== LTTP_SUPPLIER_TYPE_NAME) {
    await clearUserLttpSupplierLinks(userId, db);
    return;
  }
  if (supplierIds === undefined) {
    if (mode === "patch") {
      return;
    }
    throw new AppError({
      message: "Chọn ít nhất một nhà cung cấp.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  await replaceUserLttpSupplierLinks(userId, supplierIds, db);
}
```

Trong `users.validator.js`, thêm vào `createUserBodySchema`:

```js
  supplierIds: z.array(z.number().int().positive()).optional(),
```

`patchUserBodySchema` và `replaceUserBodySchema` kế thừa field này.

Trong `users.service.js`, import `LTTP_SUPPLIER_TYPE_NAME`, `blankUnitFieldsForSupplier`, `syncLttpSupplierAssignment` và `prisma` đã có. Thêm helper nội bộ:

```js
function assertSuperadminMayAssignSupplier(typeName, scope) {
  if (typeName !== LTTP_SUPPLIER_TYPE_NAME) {
    return;
  }
  if (scope?.mode !== UNIT_SCOPE_MODES.ALL) {
    throw new AppError({
      message: "Chỉ superadmin được tạo tài khoản nhà cung cấp.",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }
}
```

`createUser`, sau `ensureRelationsExist`:

```js
  assertSuperadminMayAssignSupplier(relations.type?.name, scope);
  const cleared = blankUnitFieldsForSupplier(relations.type?.name, {
    unitId: payload.unitId || null,
    assignedUnitId: payload.assignedUnitId || null,
    jobTitleId: payload.jobTitleId || null,
  });
```

Dùng `cleared.unitId`, `cleared.assignedUnitId`, `cleared.jobTitleId` cho kiểm tra scope, `assertAdminOnlyOnLevel1`, và `prisma.user.create`. Bỏ qua `assertJobTitleAssignableToUser` khi `cleared.jobTitleId` là null. Sau `create`, trước `return`:

```js
  await syncLttpSupplierAssignment(created.id, {
    nextTypeName: relations.type?.name,
    mode: "create",
    supplierIds: payload.supplierIds,
  }, prisma);
  return created;
```

`replaceUser` làm cùng thứ tự: chặn non-superadmin, blank field, sync `mode: "replace"` sau update.

`patchUser`: tính `nextTypeName` bằng `prisma.type.findUnique` theo `nextTypeId`. Gọi `assertSuperadminMayAssignSupplier(nextTypeName, scope)`. Nếu `nextTypeName === LTTP_SUPPLIER_TYPE_NAME`, ghi `unitId`, `assignedUnitId`, `jobTitleId` là null trong `data` (kể cả khi body không gửi các field đó). Sau `update`, gọi sync `mode: "patch"` với `supplierIds: Object.hasOwn(payload, "supplierIds") ? payload.supplierIds : undefined`.

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test src/modules/lttp-supplier/lttp-supplier.assign.test.js src/modules/lttp-supplier/lttp-supplier.links.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/lttp-supplier/lttp-supplier.links.js quanluong-app-be/src/modules/lttp-supplier/lttp-supplier.assign.test.js quanluong-app-be/src/modules/users/users.validator.js quanluong-app-be/src/modules/users/users.service.js
git commit -m "feat(lttp): save supplier links when a supplier user is written"
```

---

### Task 3: API danh sách cặp, catalog, và đặt hàng

**Files:**
- Create: `quanluong-app-be/src/modules/lttp-supplier/lttp-supplier.service.js`
- Create: `quanluong-app-be/src/modules/lttp-supplier/lttp-supplier.service.test.js`
- Create: `quanluong-app-be/src/modules/lttp-supplier/lttp-supplier.middleware.js`
- Create: `quanluong-app-be/src/modules/lttp-supplier/lttp-supplier.controller.js`
- Create: `quanluong-app-be/src/modules/lttp-supplier/lttp-supplier.routes.js`
- Create: `quanluong-app-be/src/modules/lttp-supplier/lttp-supplier.validator.js`
- Modify: `quanluong-app-be/src/app/routes.js`

**Interfaces:**
- Consumes: `getDailyOrderSummary(payload, scope, effectiveUnitIds, dataScope)` từ `lttp.service.js`. `payload` là `{ unitId, date, supplierFilter }`. `dataScope` phải có `storageUnitId` và `logicalUnitId` bằng `unitId`.
- Produces:
  - `listLttpSupplierLinks(userId, db)` → `{ links: [{ supplierId, supplierName, level1UnitId, level1UnitName }] }` sắp theo `supplierId`.
  - `listLttpSupplierCatalog(db)` → `{ suppliers: [{ id, name, level1UnitId, level1UnitName }] }` chỉ `unit.depth === 0`, sắp theo tên đơn vị rồi tên nhà cung cấp.
  - `readLttpSupplierOrders({ userId, supplierId, date, db, summarize })` → kết quả `summarize`. Không có gắn thì 404 `Không thấy nhà cung cấp của tài khoản này.` và không gọi `summarize`.
  - `ordersQuerySchema` Zod: `date` khớp `^\d{4}-\d{2}-\d{2}$`, `supplierId` số nguyên dương.
  - Mount `router.use("/lttp-supplier", lttpSupplierRouter)`.

- [ ] **Step 1: Write the failing test**

Tạo `quanluong-app-be/src/modules/lttp-supplier/lttp-supplier.service.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { listLttpSupplierCatalog, listLttpSupplierLinks, readLttpSupplierOrders } from "./lttp-supplier.service.js";
import { ordersQuerySchema } from "./lttp-supplier.validator.js";

test("orders query rejects a bad date", () => {
  assert.equal(ordersQuerySchema.safeParse({ date: "08-10-2026", supplierId: "3" }).success, false);
  assert.equal(ordersQuerySchema.safeParse({ date: "2026-10-08", supplierId: "3" }).success, true);
});

test("links map the signed-in user only", async () => {
  const db = {
    userLttpSupplier: {
      async findMany(args) {
        assert.equal(args.where.userId, 4);
        return [{
          lttpSupplier: { id: 8, name: "Công ty A", unit: { id: 10, name: "Kho 1", depth: 0 } },
        }];
      },
    },
  };
  assert.deepEqual(await listLttpSupplierLinks(4, db), {
    links: [{ supplierId: 8, supplierName: "Công ty A", level1UnitId: 10, level1UnitName: "Kho 1" }],
  });
});

test("catalog drops suppliers outside level 1", async () => {
  const db = {
    lttpSupplier: {
      async findMany(args) {
        assert.equal(args.where.unit.depth, 0);
        return [{ id: 2, name: "B", unit: { id: 1, name: "Kho", depth: 0 } }];
      },
    },
  };
  const data = await listLttpSupplierCatalog(db);
  assert.equal(data.suppliers[0].id, 2);
  assert.equal(data.suppliers[0].level1UnitName, "Kho");
});

test("orders 404 when the supplier is not linked and does not summarize", async () => {
  let called = false;
  const db = {
    userLttpSupplier: { async findFirst() { return null; } },
  };
  await assert.rejects(
    () => readLttpSupplierOrders({
      userId: 4,
      supplierId: 9,
      date: "2026-10-08",
      db,
      summarize() { called = true; },
    }),
    (err) => err.statusCode === 404 && err.message === "Không thấy nhà cung cấp của tài khoản này.",
  );
  assert.equal(called, false);
});

test("orders summarize one linked supplier storage unit", async () => {
  const db = {
    userLttpSupplier: {
      async findFirst(args) {
        assert.equal(args.where.userId, 4);
        assert.equal(args.where.lttpSupplierId, 8);
        return { lttpSupplier: { id: 8, unitId: 10 } };
      },
    },
  };
  const data = await readLttpSupplierOrders({
    userId: 4,
    supplierId: 8,
    date: "2026-10-08",
    db,
    summarize(payload, scope, effectiveUnitIds, dataScope) {
      assert.deepEqual(payload, { unitId: 10, date: "2026-10-08", supplierFilter: 8 });
      assert.equal(scope.mode, "all");
      assert.equal(effectiveUnitIds, null);
      assert.deepEqual(dataScope, { storageUnitId: 10, logicalUnitId: 10 });
      return { slipColumns: [], grandTotals: [] };
    },
  });
  assert.deepEqual(data, { slipColumns: [], grandTotals: [] });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test src/modules/lttp-supplier/lttp-supplier.service.test.js
```

Expected: FAIL, module chưa có.

- [ ] **Step 3: Write minimal implementation**

`lttp-supplier.validator.js`:

```js
import { z } from "zod";

const ordersQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  supplierId: z.coerce.number().int().positive(),
});

const userLinksParamsSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

export { ordersQuerySchema, userLinksParamsSchema };
```

`lttp-supplier.service.js`:

```js
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { UNIT_SCOPE_MODES } from "../../shared/units/unit-scope.service.js";

function mapLink(row) {
  const supplier = row.lttpSupplier;
  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    level1UnitId: supplier.unit.id,
    level1UnitName: supplier.unit.name,
  };
}

async function listLttpSupplierLinks(userId, db) {
  const rows = await db.userLttpSupplier.findMany({
    where: { userId },
    orderBy: { lttpSupplierId: "asc" },
    include: {
      lttpSupplier: {
        select: { id: true, name: true, unit: { select: { id: true, name: true, depth: true } } },
      },
    },
  });
  return { links: rows.map(mapLink) };
}

async function listLttpSupplierCatalog(db) {
  const rows = await db.lttpSupplier.findMany({
    where: { unit: { depth: 0 } },
    orderBy: [{ unit: { name: "asc" } }, { name: "asc" }],
    select: { id: true, name: true, unit: { select: { id: true, name: true, depth: true } } },
  });
  return {
    suppliers: rows.map((row) => ({
      id: row.id,
      name: row.name,
      level1UnitId: row.unit.id,
      level1UnitName: row.unit.name,
    })),
  };
}

async function readLttpSupplierOrders({ userId, supplierId, date, db, summarize }) {
  const link = await db.userLttpSupplier.findFirst({
    where: { userId, lttpSupplierId: Number(supplierId) },
    include: { lttpSupplier: { select: { id: true, unitId: true } } },
  });
  if (!link) {
    throw new AppError({
      message: "Không thấy nhà cung cấp của tài khoản này.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  const storageUnitId = link.lttpSupplier.unitId;
  return summarize(
    { unitId: storageUnitId, date, supplierFilter: Number(supplierId) },
    { mode: UNIT_SCOPE_MODES.ALL },
    null,
    { storageUnitId, logicalUnitId: storageUnitId },
  );
}

export { listLttpSupplierCatalog, listLttpSupplierLinks, readLttpSupplierOrders };
```

`lttp-supplier.middleware.js`:

```js
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { LTTP_SUPPLIER_TYPE_NAME } from "./lttp-supplier.links.js";

function lttpSupplierMiddleware(req, _res, next) {
  if (req.user?.type?.name !== LTTP_SUPPLIER_TYPE_NAME) {
    return next(new AppError({
      message: "Chỉ tài khoản nhà cung cấp được thao tác này.",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    }));
  }
  return next();
}

export { lttpSupplierMiddleware };
```

`lttp-supplier.controller.js` dùng `respondSuccess`, `prisma`, và `getDailyOrderSummary`. `links` gọi `listLttpSupplierLinks(req.user.id, prisma)`. `catalog` gọi `listLttpSupplierCatalog(prisma)`. `orders` gọi `readLttpSupplierOrders` với `summarize: getDailyOrderSummary`. Message thành công: `Danh sách nhà cung cấp`, `Danh mục nhà cung cấp`, `Đặt hàng trong ngày`.

`lttp-supplier.routes.js`:

```js
import express from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { superadminMiddleware } from "../../middlewares/superadmin.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import { lttpSupplierMiddleware } from "./lttp-supplier.middleware.js";
import { ordersQuerySchema, userLinksParamsSchema } from "./lttp-supplier.validator.js";
import {
  getLttpSupplierCatalogController,
  getLttpSupplierLinksController,
  getLttpSupplierOrdersController,
} from "./lttp-supplier.controller.js";

const lttpSupplierRouter = express.Router();

lttpSupplierRouter.get(
  "/catalog",
  authMiddleware,
  superadminMiddleware,
  asyncHandler(getLttpSupplierCatalogController),
);
lttpSupplierRouter.get(
  "/users/:userId/links",
  authMiddleware,
  superadminMiddleware,
  validateRequest({ params: userLinksParamsSchema }),
  asyncHandler(getLttpSupplierLinksForUserController),
);
lttpSupplierRouter.get(
  "/links",
  authMiddleware,
  lttpSupplierMiddleware,
  asyncHandler(getLttpSupplierLinksController),
);
lttpSupplierRouter.get(
  "/orders",
  authMiddleware,
  lttpSupplierMiddleware,
  validateRequest({ query: ordersQuerySchema }),
  asyncHandler(getLttpSupplierOrdersController),
);

export { lttpSupplierRouter };
```

`getLttpSupplierLinksForUserController` gọi `listLttpSupplierLinks(Number(req.params.userId), prisma)`.

Trong `routes.js`:

```js
import { lttpSupplierRouter } from "../modules/lttp-supplier/lttp-supplier.routes.js";
router.use("/lttp-supplier", lttpSupplierRouter);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test src/modules/lttp-supplier/lttp-supplier.service.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add quanluong-app-be/src/modules/lttp-supplier quanluong-app-be/src/app/routes.js
git commit -m "feat(lttp): serve one supplier's daily order"
```

---

### Task 4: Chuyển cổng sau đăng nhập

**Files:**
- Modify: `packages/shared/src/utils/postLoginPath.js`
- Modify: `packages/shared/src/utils/postLoginPath.test.js`
- Create: `packages/shared/src/utils/supplierPortal.js`
- Create: `packages/shared/src/utils/supplierPortal.test.js`
- Modify: `packages/shared/src/utils/runtimeEnv.js`
- Create: `packages/shared/src/hocs/LttpSupplierRedirect.jsx`
- Modify: `packages/shared/src/pages/login/LoginPage.jsx`
- Modify: `apps/web/app/layout.jsx`
- Modify: `apps/superadmin/app/layout.jsx`

**Interfaces:**
- Consumes: `LTTP_SUPPLIER_TYPE_NAME` không import từ backend. Hằng phía client là chuỗi `"lttp_supplier"`.
- Produces:
  - `isLttpSupplierUser(user)` 
  - `resolvePostLoginPath(user, fromRaw, origins?)` — với nhà cung cấp trả `` `${origins.supplierOrigin}/dat-hang` ``. `origins.supplierOrigin` mặc định `http://localhost:3002`. Bỏ `from`.
  - `getSupplierAppOrigin()` đọc `NEXT_PUBLIC_SUPPLIER_ORIGIN` qua `getSupplierOriginEnv()`. Không có env: cổng trình duyệt `8080` hoặc `8081` → cùng host cổng `8082`; cổng `3000` hoặc `3001` → cổng `3002`; còn lại `http://localhost:3002`.
  - `LttpSupplierRedirect` — client component, trong `AppProviders`, `window.location.replace(getSupplierAppOrigin() + "/dat-hang")` khi session là nhà cung cấp.

- [ ] **Step 1: Write the failing test**

Thêm vào `postLoginPath.test.js`:

```js
import { isLttpSupplierUser } from "./postLoginPath.js";

test("resolvePostLoginPath sends supplier to the supplier app and ignores from", () => {
  assert.equal(isLttpSupplierUser({ type: { name: "lttp_supplier" } }), true);
  assert.equal(isLttpSupplierUser({ type: { name: "admin" } }), false);
  assert.equal(
    resolvePostLoginPath(
      { type: { name: "lttp_supplier" } },
      "/dashboard",
      { supplierOrigin: "http://localhost:8082" },
    ),
    "http://localhost:8082/dat-hang",
  );
});
```

Tạo `packages/shared/src/utils/supplierPortal.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { supplierOriginFromLocation } from "./supplierPortal.js";

test("supplier origin uses port 8082 next to the main and admin apps", () => {
  assert.equal(
    supplierOriginFromLocation({ protocol: "http:", hostname: "localhost", port: "8080" }),
    "http://localhost:8082",
  );
  assert.equal(
    supplierOriginFromLocation({ protocol: "http:", hostname: "localhost", port: "8081" }),
    "http://localhost:8082",
  );
  assert.equal(
    supplierOriginFromLocation({ protocol: "http:", hostname: "localhost", port: "3000" }),
    "http://localhost:3002",
  );
  assert.equal(
    supplierOriginFromLocation({ protocol: "http:", hostname: "localhost", port: "3001" }),
    "http://localhost:3002",
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Từ `packages/shared`:

```bash
node --test src/utils/postLoginPath.test.js src/utils/supplierPortal.test.js
```

Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`runtimeEnv.js` thêm:

```js
export function getSupplierOriginEnv() {
  const v = process.env.NEXT_PUBLIC_SUPPLIER_ORIGIN;
  return v && String(v).trim() !== "" ? v : undefined;
}
```

`supplierPortal.js` lặp cách `preferEnvOrigin` của `superadminPortal.js`. Export `supplierOriginFromLocation({ protocol, hostname, port })` và `getSupplierAppOrigin()`.

`postLoginPath.js`:

```js
export function isLttpSupplierUser(user) {
  return user?.type?.name === "lttp_supplier";
}

export function resolvePostLoginPath(user, fromRaw, origins = {}) {
  if (isSuperadminUser(user)) {
    return SUPERADMIN_PORTAL_CHOOSER_PATH;
  }
  if (isLttpSupplierUser(user)) {
    const origin = String(origins.supplierOrigin || "http://localhost:3002").replace(/\/+$/, "");
    return `${origin}/dat-hang`;
  }
  return safeInternalPath(fromRaw);
}
```

`LoginPage.jsx` `onSubmit`: nếu `next` bắt đầu bằng `http://` hoặc `https://` thì `window.location.assign(next)` và return. Truyền `{ supplierOrigin: getSupplierAppOrigin() }` vào `resolvePostLoginPath`.

`LttpSupplierRedirect.jsx`:

```jsx
"use client";

import { useEffect } from "react";
import { useAuthInitialized, useCurrentUser } from "@/features/auth/model/authSlice";
import { isLttpSupplierUser } from "@/utils/postLoginPath";
import { getSupplierAppOrigin } from "@/utils/supplierPortal";

export function LttpSupplierRedirect() {
  const initialized = useAuthInitialized();
  const user = useCurrentUser();

  useEffect(() => {
    if (!initialized || !isLttpSupplierUser(user)) {
      return;
    }
    window.location.replace(`${getSupplierAppOrigin()}/dat-hang`);
  }, [initialized, user]);

  return null;
}
```

Trong `apps/web/app/layout.jsx` và `apps/superadmin/app/layout.jsx`, bên trong `AppProviders`, trước `{children}`:

```jsx
<LttpSupplierRedirect />
```

Không gắn component này vào app nhà cung cấp.

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test src/utils/postLoginPath.test.js src/utils/supplierPortal.test.js
```

Expected: PASS. Test cũ của superadmin và `from` vẫn PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/utils/postLoginPath.js packages/shared/src/utils/postLoginPath.test.js packages/shared/src/utils/supplierPortal.js packages/shared/src/utils/supplierPortal.test.js packages/shared/src/utils/runtimeEnv.js packages/shared/src/hocs/LttpSupplierRedirect.jsx packages/shared/src/pages/login/LoginPage.jsx apps/web/app/layout.jsx apps/superadmin/app/layout.jsx
git commit -m "feat(lttp): send supplier accounts to the supplier app"
```

---

### Task 5: Ô chọn nhà cung cấp trên màn user

**Files:**
- Create: `packages/shared/src/features/lttp-supplier/api/lttpSupplierApi.js`
- Modify: `packages/shared/src/pages/dashboard/superadmin/SuperadminUsersPanel.jsx`
- Test: `packages/shared/src/pages/dashboard/superadmin/SuperadminUsersPanel.test.js`

**Interfaces:**
- Consumes: `GET /lttp-supplier/catalog` → `data.suppliers`. `POST /users` và `PATCH /users/:id` nhận `supplierIds`.
- Produces: form tạo user. Khi `typesForCreate` có item đang chọn với `name === "lttp_supplier"`, hiện checkbox từng nhà cung cấp, nhãn `{level1UnitName} — {name}`. Gửi `supplierIds` là các id đang chọn, và `unitId: null`. Ẩn select đơn vị trong trường hợp đó. Chưa chọn nhà cung cấp thì không submit, toast `Chọn ít nhất một nhà cung cấp.`
  - Mỗi dòng user có `type.name === "lttp_supplier"` có nút «Sửa nhà cung cấp». Nút gọi `GET /lttp-supplier/users/:id/links`, tick đúng các `supplierId` trả về, rồi `PATCH /users/:id` với `{ supplierIds }`. Mảng rỗng thì không gửi, toast cùng câu trên.

- [ ] **Step 1: Write the failing test**

Tạo `packages/shared/src/pages/dashboard/superadmin/SuperadminUsersPanel.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("supplier create form sends supplierIds and hides the unit select", () => {
  const src = readFileSync(new URL("./SuperadminUsersPanel.jsx", import.meta.url), "utf8");
  assert.match(src, /lttp_supplier/);
  assert.match(src, /supplierIds/);
  assert.match(src, /Chọn ít nhất một nhà cung cấp\./);
  assert.match(src, /\/lttp-supplier\/catalog/);
  assert.match(src, /Sửa nhà cung cấp/);
  assert.match(src, /\/lttp-supplier\/users\//);
});
```

- [ ] **Step 2: Run test to verify it fails**

Từ `packages/shared`:

```bash
node --test src/pages/dashboard/superadmin/SuperadminUsersPanel.test.js
```

Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`lttpSupplierApi.js`:

```js
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/services/apiRequest";

export function useLttpSupplierCatalogQuery(options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: ["lttp-supplier", "catalog"],
    queryFn: () => apiRequest({ url: "/lttp-supplier/catalog", method: "get" }),
    enabled: skip !== true,
    ...rest,
  });
}

export function useLttpSupplierLinksQuery(options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: ["lttp-supplier", "links"],
    queryFn: () => apiRequest({ url: "/lttp-supplier/links", method: "get" }),
    enabled: skip !== true,
    ...rest,
  });
}

export function useLttpSupplierOrdersQuery({ date, supplierId }, options = {}) {
  const { skip, ...rest } = options;
  return useQuery({
    queryKey: ["lttp-supplier", "orders", date, supplierId],
    queryFn: () => apiRequest({
      url: "/lttp-supplier/orders",
      method: "get",
      params: { date, supplierId },
    }),
    enabled: skip !== true && Boolean(date) && supplierId != null,
    ...rest,
  });
}
```

Trong `SuperadminUsersPanel.jsx`, state `supplierIds` là `number[]`. `selectedTypeName` lấy từ `typesForCreate` theo `typeId`. Khi tên là `lttp_supplier`, gọi catalog (`skip` khi không phải loại đó). Thay ô đơn vị bằng `<fieldset>` các checkbox. `onCreateUser` với loại này: nếu `supplierIds.length === 0` thì `notifyError("Chọn ít nhất một nhà cung cấp.")` và return. Payload `unitId: null`, `supplierIds`. Loại khác không gửi `supplierIds`.

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test src/pages/dashboard/superadmin/SuperadminUsersPanel.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/features/lttp-supplier/api/lttpSupplierApi.js packages/shared/src/pages/dashboard/superadmin/SuperadminUsersPanel.jsx packages/shared/src/pages/dashboard/superadmin/SuperadminUsersPanel.test.js
git commit -m "feat(lttp): pick suppliers when creating a supplier account"
```

---

### Task 6: Trang đặt hàng và app nhà cung cấp

**Files:**
- Create: `packages/shared/src/pages/lttp-supplier/supplierOrderView.js`
- Create: `packages/shared/src/pages/lttp-supplier/supplierOrderView.test.js`
- Create: `packages/shared/src/pages/lttpNhapXuat/lttpOrderingMatrix.js`
- Modify: `packages/shared/src/pages/lttpNhapXuat/LttpOrderingTab.jsx`
- Create: `packages/shared/src/pages/lttp-supplier/SupplierOrderPage.jsx`
- Create: `packages/shared/src/hocs/SupplierOnlyRoute.jsx`
- Create: `apps/supplier/` từ bản sao tối thiểu của `apps/superadmin` (package, next.config, postcss, tailwind, jsconfig, eslint, middleware, `src/lttp-next/captureElementToPng.js`, `app/globals.css`, `app/layout.jsx`)
- Create: `apps/supplier/app/(private)/layout.jsx`
- Create: `apps/supplier/app/(private)/dat-hang/page.jsx`
- Modify: `package.json` scripts `dev:supplier` và `build:supplier`
- Modify: `docker-compose.dev.yml`, `docker-compose.prod-ui.yml`, `Dockerfile`, `docker/docker-entrypoint-next-ui.sh`

**Interfaces:**
- Consumes: `buildOrderingMatrix(summary)` trả `{ columns, rows, qtyBySlip }` như `useMemo` hiện tại trong `LttpOrderingTab.jsx` (khoảng dòng 306–344), gồm `slipRefLabel`. `useLttpSupplierLinksQuery`, `useLttpSupplierOrdersQuery`, `captureElementToPngBlob`, `getMainAppOrigin`.
- Produces:
  - `initialSupplierId(links)` → `links[0].supplierId` khi đúng một phần tử, còn lại `null`.
  - `pairLabel(link)` → `` `${link.level1UnitName} — ${link.supplierName}` ``.
  - `recipientKeys(summary)` → các `String(col.recipientUnitId ?? "none")` duy nhất, theo thứ tự `slipColumns`.
  - `filterOrderSummaryByRecipientUnits(summary, selectedKeys)` → summary mới, `slipColumns` chỉ các key đang chọn. `grandTotals` cộng lại `quantity` của các dòng còn lại theo `commodityId`. `quantityFormatted` dùng cùng quy tắc `toFixed(4)` rồi bỏ số 0 thừa.
  - Trang `/dat-hang`.

- [ ] **Step 1: Write the failing test**

Tạo `packages/shared/src/pages/lttp-supplier/supplierOrderView.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  filterOrderSummaryByRecipientUnits,
  initialSupplierId,
  pairLabel,
  recipientKeys,
} from "./supplierOrderView.js";

test("one link is selected and two links wait", () => {
  const one = [{ supplierId: 3, level1UnitName: "Kho", supplierName: "A" }];
  assert.equal(initialSupplierId(one), 3);
  assert.equal(initialSupplierId([...one, { supplierId: 4 }]), null);
  assert.equal(pairLabel(one[0]), "Kho — A");
});

test("recipient filter drops a column and rebuilds the total", () => {
  const summary = {
    slipColumns: [
      { slipId: 1, recipientUnitId: 10, recipientUnitName: "Đơn vị A", lines: [
        { commodityId: 1, name: "Gạo", measureUnit: "kg", quantity: 2, quantityFormatted: "2" },
      ] },
      { slipId: 2, recipientUnitId: 11, recipientUnitName: "Đơn vị B", lines: [
        { commodityId: 1, name: "Gạo", measureUnit: "kg", quantity: 1.5, quantityFormatted: "1.5" },
      ] },
    ],
    grandTotals: [{ commodityId: 1, name: "Gạo", measureUnit: "kg", quantity: 3.5, quantityFormatted: "3.5" }],
  };
  assert.deepEqual(recipientKeys(summary), ["10", "11"]);
  const filtered = filterOrderSummaryByRecipientUnits(summary, ["10"]);
  assert.equal(filtered.slipColumns.length, 1);
  assert.equal(filtered.grandTotals[0].quantityFormatted, "2");
  const none = filterOrderSummaryByRecipientUnits(summary, []);
  assert.equal(none.slipColumns.length, 0);
  assert.equal(none.grandTotals.length, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Từ `packages/shared`:

```bash
node --test src/pages/lttp-supplier/supplierOrderView.test.js
```

Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`supplierOrderView.js` export bốn hàm ở Interfaces. Format số:

```js
function formatQty(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  const t = x.toFixed(4).replace(/\.?0+$/, "");
  return t === "" ? "0" : t;
}
```

`lttpOrderingMatrix.js` chứa `buildOrderingMatrix(summary)` chuyển nguyên logic `useMemo` hiện tại, và `slipRefLabel` nếu hàm đó đang private trong tab. `LttpOrderingTab.jsx` gọi `buildOrderingMatrix(summary)` trong `useMemo`. Không đổi nút PNG, copy, hay Zalo của tab.

`SupplierOrderPage.jsx`:

- `links` từ `useLttpSupplierLinksQuery`.
- `links.length === 0` → `Superadmin chưa gắn nhà cung cấp.`
- `supplierId` state khởi tạo bằng `initialSupplierId`. Nhiều cặp: `<select>` bắt buộc, option rỗng «Chọn đơn vị và nhà cung cấp», label `pairLabel`. Đổi select thì không nhớ sau reload (state thường, không localStorage).
- `supplierId == null` thì không gọi orders.
- Ngày `<input type="date">`, mặc định hôm nay bằng `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" })`.
- `selectedKeys` state. Khi `slipColumns` đổi, đặt lại bằng `recipientKeys(summary)` (chọn tất cả).
- Fieldset checkbox theo `recipientKeys`. Bỏ hết → câu `Chọn ít nhất một đơn vị nhận.` và không vẽ bảng, không chụp ảnh.
- `filterOrderSummaryByRecipientUnits` rồi `buildOrderingMatrix`. Không có `rows` → `Không có đặt hàng trong ngày này.`
- Bảng: cột đầu là mặt hàng và đơn vị tính; mỗi `columns[]` một cột, header `recipientUnitName`; ô là `quantityFormatted` và `lineNote` nếu có.
- `useEffect` phụ thuộc ngày, `supplierId`, và `selectedKeys`: khi có `rows`, `captureElementToPngBlob` trên ref của bảng và gán blob URL vào `<img alt="Ảnh đặt hàng">`. Không nút tải, copy, chia sẻ. Hủy URL cũ khi đổi ảnh.

`SupplierOnlyRoute.jsx`: chưa session → `window.location.replace(getMainAppOrigin() + "/login")`. Session không phải `lttp_supplier` → `window.location.replace(getMainAppOrigin() + "/")`. Đúng loại thì render children.

`apps/supplier/package.json` copy `apps/superadmin/package.json`, `name` là `@quanluong/superadmin` đổi thành `@quanluong/supplier`, mọi cổng `3001` đổi thành `3002`.

`apps/supplier/next.config.mjs` copy superadmin, đổi chuỗi `apps/superadmin` trong thông báo lỗi thành `apps/supplier`, và đường `superadminCaptureBundle` thành `apps/supplier/src/lttp-next/captureElementToPng.js`. Copy file capture đó nguyên văn.

`app/(private)/layout.jsx` bọc `PrivateRoute` rồi `SupplierOnlyRoute` rồi `children`. Không `MainLayout`, không `LttpSupplierRedirect`.

`app/(private)/dat-hang/page.jsx` render `<SupplierOrderPage />`.

`package.json` gốc:

```json
"dev:supplier": "npm run dev --workspace=@quanluong/supplier",
"build:supplier": "npm run build --workspace=@quanluong/supplier"
```

`docker-compose.dev.yml`: service `ui-supplier` copy `ui-superadmin`, cổng `8082:3002`, container `quanluong-app-ui-supplier`, volume `./apps/supplier` và `ui_supplier_next`, workspace `@quanluong/supplier`, env thêm `NEXT_PUBLIC_SUPPLIER_ORIGIN: ${UI_SUPPLIER_ORIGIN:-http://localhost:8082}`. Thêm env đó vào service `ui` và `ui-superadmin`. Volume `ui_supplier_next`.

`Dockerfile`: `COPY apps/supplier ./apps/supplier` cạnh copy superadmin. Stage `next-supplier-built` copy `next-superadmin-built` và build workspace `@quanluong/supplier`, ARG/ENV `NEXT_PUBLIC_SUPPLIER_ORIGIN` mặc định `http://localhost:8082`. Stage `ui-supplier` copy `ui-superadmin` với `NEXT_UI_APP=supplier` và copy static từ `next-supplier-built`. `EXPOSE` của `ui-dev` thêm `3002`.

`docker-entrypoint-next-ui.sh` thêm nhánh:

```sh
  supplier)
    node /app/apps/supplier/server.js &
    ;;
```

`docker-compose.prod-ui.yml`: service `ui-supplier`, target `ui-supplier`, image `quanluong-ui-supplier:latest`, container `quanluong-app-ui-supplier`, cổng `8082:80`, cùng `API_BASE_URL_INTERNAL` và `media_data` như superadmin. Build args có `NEXT_PUBLIC_SUPPLIER_ORIGIN`.

- [ ] **Step 4: Run test to verify it passes**

Từ `packages/shared`:

```bash
node --test src/pages/lttp-supplier/supplierOrderView.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/pages/lttp-supplier packages/shared/src/pages/lttpNhapXuat/lttpOrderingMatrix.js packages/shared/src/pages/lttpNhapXuat/LttpOrderingTab.jsx packages/shared/src/hocs/SupplierOnlyRoute.jsx apps/supplier package.json docker-compose.dev.yml docker-compose.prod-ui.yml Dockerfile docker/docker-entrypoint-next-ui.sh
git commit -m "feat(lttp): show the daily order on the supplier app"
```
