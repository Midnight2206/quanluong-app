# Sổ sách bếp ăn — Thực đơn (MVP)

Ngày: 2026-07-06

## Mục tiêu

Module **Sổ sách bếp ăn** giúp bếp lập **thực đơn theo ngày và buổi** (sáng / trưa / chiều), gắn
nguyên liệu LTTP với hai cách tính số lượng từ **quân số** (lấy readonly từ Chấm cơm).

Giai đoạn sau (ngoài MVP): tab **Tổng hợp tháng**, **xuất Google Sheets** qua Chứng từ quyết toán.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Vị trí app | Menu riêng **«Sổ sách bếp ăn»** → `/so-sach-bep-an` |
| MVP | Tab **Thực đơn** (theo ngày) + tab **Danh mục món** (kho chung); tab Tổng hợp placeholder |
| Danh mục món | Gắn **`storageUnitId`** — **dùng chung** giữa mọi đơn vị có cùng scope LTTP |
| Scope / đơn vị lưu | Resolve kho bằng **`dataKind: LTTP_COMMODITY`** (trùng LTTP); `logicalUnitId` từ UI; **không** dùng `user.unitId` khi ghi |
| Thực đơn ngày | **Cùng `storageUnitId` với LTTP** → các đơn vị cùng scope LTTP **dùng chung** lịch thực đơn ngày + danh mục món |
| Quân số | Tự động từ **Chấm cơm**, **chỉ đọc** trên màn thực đơn ngày |
| Món ăn | Tên món (text) + danh sách nguyên liệu LTTP |
| Tính SL — khối lượng/thể tích | Định mức **g hoặc ml / người** × quân số → hiển thị **kg** hoặc **L** |
| Tính SL — gói / hộp / cây | **Số người / 1 đơn vị** → `⌈quân số ÷ số người/đơn vị⌉` (làm tròn lên) |
| ĐVT khác | g/ml mặc định cho khối lượng/thể tích; gói/hộp/cây dùng chế độ chia suất |
| Kiến trúc | Module backend mới `kitchen-books`; Prisma models riêng (không JSON blob) |

## Phạm vi MVP

### Trong phạm vi

- Route + permission + nav
- **Danh mục món theo đơn vị** (CRUD + tìm kiếm trong phạm vi `unitId` đang chọn)
- CRUD thực đơn ngày: đơn vị × ngày × buổi × (món → dòng LTTP)
- **Chọn món từ danh mục** vào thực đơn ngày (sao chép định mức LTTP)
- **Lưu món thực đơn vào danh mục** đơn vị hiện tại
- Headcount readonly theo ngày/buổi/đơn vị
- Tính tổng SL hiển thị realtime (FE + BE validate)
- Lịch tháng nhẹ: đánh dấu ngày đã có thực đơn
- Unit scope + **data scope** (`unitDataScopeMiddleware`) cho catalog và menu — **khớp LTTP**, không khớp meal-roster thuần `unitId` body

### Ngoài phạm vi (YAGNI)

- Tab Tổng hợp tháng (logic nghiệp vụ)
- Xuất Google Sheets / template TỔNG HỢP
- Sổ tiếp phẩm hàng ngày
- AI gợi ý thực đơn
- Copy thực đơn sang ngày khác (có thể thêm sau)
- Lưu snapshot headcount vào DB
- Danh mục món **dùng chung cross-unit / toàn hệ thống**

## Phạm vi dữ liệu (scope) — quan trọng

Dù tài khoản nào thao tác, dữ liệu thực đơn/danh mục phải vào **đúng đơn vị kho** đã được hệ thống quy định — không phụ thuộc đơn vị gốc gán cho user.

### Hai lớp `unitId` (giống LTTP)

| Khái niệm | Nguồn | Vai trò |
|-----------|--------|---------|
| **`logicalUnitId`** | `unitId` query/body hoặc header `X-Target-Unit-Id` (đơn vị user **đang chọn** trên UI) | Ngữ cảnh làm việc; phải nằm trong nhánh quyền |
| **`storageUnitId`** | `resolvePrivateStorageUnitId({ dataKind: "LTTP_COMMODITY" })` | **Cột `unitId` khi ghi DB** — trùng kho LTTP |

**Hệ quả — dùng chung thực đơn theo scope LTTP:**

- Hai đơn vị A, B nếu cùng resolve ra **một `storageUnitId`** như danh mục LTTP → **cùng** danh mục món **và** cùng thực đơn ngày (`KitchenMenuDay` theo `menuDate`).
- Đơn vị `INDEPENDENT` → thực đơn riêng. Không cấu hình chia sẻ riêng — **luôn khớp** LTTP.

Luồng ghi:

1. FE: selector đơn vị → `unitId` + `X-Target-Unit-Id`.
2. BE: `unitDataScopeMiddleware({ dataKind: "LTTP_COMMODITY" })`.
3. Persist catalog + menu với `unitId = storageUnitId`.
4. Validate `commodity.unitId === storageUnitId`.

### Middleware

Mọi route kitchen-books:

```javascript
unitDataScopeMiddleware({ dataKind: "LTTP_COMMODITY", asOfQueryKeys: ["date"] })
```

Không tạo data kind / chính sách scope riêng — grant và kế thừa **y chang** LTTP.

### Headcount (Chấm cơm)

Quân số lấy theo **`logicalUnitId`** (đơn vị đang chọn trên UI), không theo `storageUnitId` — vì chấm cơm ghi theo từng đơn vị. Khi nhiều đơn vị dùng chung thực đơn món, mỗi lần mở với đơn vị khác nhau có thể thấy **quân số khác** nhưng **cùng danh sách món**; tổng nguyên liệu tính lại theo quân số hiện tại.

## Hai tầng dữ liệu

### 1. Danh mục món (theo `storageUnitId` — kho tái sử dụng)

Món mẫu gắn **`unitId` = storageUnitId** khi lưu. UI hiển thị đơn vị **đang làm việc** (`logicalUnitId`); backend map sang kho theo chính sách.

**Lý do:** Mỗi kho LTTP có danh mục riêng; thực đơn mẫu phải nằm cùng kho với LTTP. Scope đảm bảo mọi tài khoản có quyền đều ghi vào **đúng kho quy định**, không theo đơn vị gốc của user.

```
Tab «Danh mục món»   [Đơn vị đang làm việc ▼]  (+ badge «Kho dữ liệu: …» nếu khác tên — tùy chọn UI)

[Tìm món…]                                    [+ Thêm món mới]
```

- `@@unique([unitId, name])` với `unitId` = storage
- `commodityId` phải có `LttpCommodity.unitId === storageUnitId`

### 2. Thực đơn ngày (cùng `storageUnitId` — dùng chung trong nhóm LTTP)

Lịch **ngày × buổi** cũng gắn `unitId = storageUnitId`. Đơn vị B (con, kế thừa LTTP từ A) và cán bộ tại A **thấy và sửa cùng** thực đơn ngày 06/07 khi cùng resolve về kho A.

Quân số tính theo **`logicalUnitId`** đang chọn (Chấm cơm từng đơn vị) — có thể khác nhau dù chung thực đơn món; tổng SL LTTP = định mức × quân số **của đơn vị đang lập**.

**Chọn từ danh mục:** chỉ món có `catalog.unitId === menu.storageUnitId` (cùng kho sau resolve).

**Lưu vào danh mục:** ghi vào kho `storageUnitId` của ngữ cảnh hiện tại.

`sourceCatalogId` trên `KitchenMenuDish` (optional) — chỉ để truy vết, không sync ngược.

## Màn hình Thực đơn (ngày)

```
[Đơn vị] [Tháng ▼]   [← 06/07/2026 →]   (chấm ngày có dữ liệu trên lịch tháng)

Buổi:  Sáng | Trưa | Chiều

Quân số: 128   (từ Chấm cơm — chỉ đọc)

── Món 1: Canh chua cá ─────────────────────────────
  LTTP         | Nhập              | Tổng cần
  Cá fillet    | 150 g/người       | 19,2 kg
  Nước mắm     | 5 ml/người        | 0,64 L
  Rau gói      | 8 người / 1 gói   | 16 gói
  [+ Nguyên liệu]

[+ Thêm món]   [Chọn từ danh mục…]
```

- Chuyển ngày/buổi không mất draft chưa lưu → confirm nếu dirty
- Tìm mặt hàng LTTP: tái sử dụng pattern `IssueSlipCommoditySearch`
- Khi chọn LTTP, app gợi ý `calcMode` theo `measureUnit` danh mục
- Nút «Lưu vào danh mục» trên từng món (lưu vào kho đơn vị hiện tại)

## Quân số (headcount)

Tính tại read-time từ Chấm cơm theo **`logicalUnitId`** + `yearMonth` + `dayOfMonth` + `mealPeriod`:

1. **Ăn tiêu chuẩn:** đếm số `mealRosterEntryId` distinct có `MealRosterDayMark` tại (ngày, buổi) với `mealAllowanceRateId` không null.
2. **Ăn thêm:** đếm `MealRosterDayExtraMark` theo ngày; phân bổ vào buổi qua `MealRosterDayExtraSplit.periodsJson` (mặc định chia đều 3 buổi nếu không có split tùy chỉnh — khớp logic `meal-roster` hiện có).

`headcount = standardCount + extraCountForPeriod`

Nếu chưa có dữ liệu chấm cơm → hiển thị `0` và tooltip «Chưa chấm cơm ngày này».

## Tính số lượng LTTP

### Chế độ `per_person` (khối lượng / thể tích)

- Input: `perPersonAmount` (Decimal), `perPersonUnit` ∈ `{ g, ml }`
- Output: `totalQuantity`, `totalUnit` ∈ `{ kg, L }`
- Công thức: `total = perPersonAmount × headcount / 1000`
- ĐVT LTTP gốc (kg, L, g, ml…) chỉ dùng để **gợi ý** chế độ; nhập luôn theo g/ml trên UI

### Chế độ `per_unit_shared` (gói, hộp, cây)

- Input: `peoplePerUnit` (Decimal > 0) — số người dùng chung 1 đơn vị
- Output: `totalQuantity = ceil(headcount / peoplePerUnit)`, `totalUnit` = ĐVT LTTP
- Phân loại ĐVT shared (không phân biệt hoa thường, trim): `gói`, `goi`, `hộp`, `hop`, `cây`, `cay`

### Phân loại tự động khi chọn LTTP

```text
measureUnit normalized ∈ SHARED_UNITS     → per_unit_shared
measureUnit normalized ∈ MASS_VOLUME      → per_person
khác                                      → per_person (mặc định; user có thể đổi tay nếu cần — phase sau)
```

MVP: không cho đổi `calcMode` tay trên UI (chỉ auto); giảm phức tạp.

## Data model (Prisma)

### Danh mục món (theo unitId)

```prisma
model KitchenDishCatalog {
  id        Int      @id @default(autoincrement())
  unitId    Int
  name      String   @db.VarChar(300)
  note      String?  @db.VarChar(500)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  unit      Unit     @relation(...)
  lines     KitchenDishCatalogLine[]
  menuDishes KitchenMenuDish[] @relation("MenuDishSourceCatalog")

  @@unique([unitId, name])
  @@index([unitId])
}

model KitchenDishCatalogLine {
  id              Int      @id @default(autoincrement())
  catalogId       Int
  commodityId     Int
  calcMode        KitchenMenuCalcMode
  perPersonAmount Decimal? @db.Decimal(18, 4)
  perPersonUnit   KitchenMenuPerPersonUnit?
  peoplePerUnit   Decimal? @db.Decimal(18, 4)
  sortOrder       Int      @default(0)
  catalog         KitchenDishCatalog @relation(...)
  commodity       LttpCommodity      @relation(...)

  @@index([catalogId])
  @@index([commodityId])
}
```

### Thực đơn ngày (theo đơn vị)

```prisma
enum KitchenMenuMealPeriod {
  sang
  trua
  chieu
}

enum KitchenMenuCalcMode {
  per_person
  per_unit_shared
}

enum KitchenMenuPerPersonUnit {
  g
  ml
}

model KitchenMenuDay {
  id        Int      @id @default(autoincrement())
  unitId    Int
  menuDate  DateTime @db.Date
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  unit      Unit     @relation(...)
  periods   KitchenMenuPeriod[]

  @@unique([unitId, menuDate])
  @@index([unitId, menuDate])
}

model KitchenMenuPeriod {
  id         Int                   @id @default(autoincrement())
  dayId      Int
  mealPeriod KitchenMenuMealPeriod
  note       String?               @db.VarChar(500)
  day        KitchenMenuDay        @relation(...)
  dishes     KitchenMenuDish[]

  @@unique([dayId, mealPeriod])
}

model KitchenMenuDish {
  id               Int      @id @default(autoincrement())
  periodId         Int
  name             String   @db.VarChar(300)
  sortOrder        Int      @default(0)
  sourceCatalogId  Int?     /// Truy vết món copy từ danh mục; không sync live
  period           KitchenMenuPeriod @relation(...)
  sourceCatalog    KitchenDishCatalog? @relation("MenuDishSourceCatalog", ...)
  lines            KitchenMenuDishLine[]

  @@index([periodId])
  @@index([sourceCatalogId])
}

model KitchenMenuDishLine {
  id              Int      @id @default(autoincrement())
  dishId          Int
  commodityId     Int
  calcMode        KitchenMenuCalcMode
  perPersonAmount Decimal? @db.Decimal(18, 4)
  perPersonUnit   KitchenMenuPerPersonUnit?
  peoplePerUnit   Decimal? @db.Decimal(18, 4)
  sortOrder       Int      @default(0)
  dish            KitchenMenuDish @relation(...)
  commodity       LttpCommodity   @relation(...)

  @@index([dishId])
  @@index([commodityId])
}
```

Ràng buộc validator (Zod):

- `per_person` → bắt buộc `perPersonAmount > 0` + `perPersonUnit`
- `per_unit_shared` → bắt buộc `peoplePerUnit > 0`
- `commodityId` phải tồn tại và `LttpCommodity.unitId === dataScope.storageUnitId`
- Service helpers (mirror `lttp.service.js`): `assertKitchenLogicalMatchesDataScope`, `assertKitchenRowStorage`

## API

Base: `/api/kitchen-books`

Tất cả endpoint: `unitScopeMiddleware` + `effectiveUnitScopeMiddleware` + **`unitDataScopeMiddleware({ dataKind: "LTTP_COMMODITY" })`**.

### Danh mục món

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/catalog?unitId&q&limit&offset` | Liệt kê / tìm món trong đơn vị |
| GET | `/catalog/:id?unitId=` | Chi tiết (verify catalog thuộc unit) |
| POST | `/catalog` | Tạo món `{ unitId, name, lines[] }` |
| PUT | `/catalog/:id` | Sửa món + thay lines (verify unit) |
| DELETE | `/catalog/:id?unitId=` | Xóa món trong đơn vị |

### Thực đơn ngày

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/menu?unitId&date=YYYY-MM-DD` | Thực đơn 1 ngày (3 buổi), mỗi buổi kèm `headcount` + dishes/lines + `totalQuantity` computed |
| PUT | `/menu` | Upsert toàn bộ 1 buổi: `{ unitId, date, mealPeriod, dishes: [...] }` |
| POST | `/menu/import-catalog` | Copy món catalog → buổi; reject nếu khác `storageUnitId` |
| GET | `/menu/month-markers?unitId&yearMonth=YYYY-MM` | Ngày có ít nhất 1 món |
| DELETE | `/menu/dish/:dishId` | Xóa món trên thực đơn ngày |

`import-catalog` và `PUT /catalog` **không** tin `unitId` từ body để chọn kho — chỉ dùng `dataScope.storageUnitId` sau middleware.

Permission: `kitchenBooks.access` — đọc/ghi danh mục + thực đơn trong phạm vi đơn vị được phép.

Response line mẫu:

```json
{
  "commodityId": 1204,
  "commodity": { "code": "...", "name": "...", "measureUnit": "kg" },
  "calcMode": "per_person",
  "perPersonAmount": "150",
  "perPersonUnit": "g",
  "peoplePerUnit": null,
  "headcount": 128,
  "totalQuantity": "19.2",
  "totalUnit": "kg"
}
```

## Backend module

```
quanluong-app-be/src/modules/kitchen-books/
  kitchen-books.constants.js
  kitchen-books.route-definitions.js
  kitchen-books.routes.js
  kitchen-books.controller.js
  kitchen-books.validator.js
  kitchen-books.service.js
  kitchen-books-headcount.service.js
  kitchen-books-quantity.js          # pure functions + unit tests
  kitchen-books-quantity.test.js
```

Mount trong `src/app/routes.js`: `router.use("/kitchen-books", kitchenBooksRouter)`.

## Frontend

```
packages/shared/src/pages/kitchen-books/
  KitchenBooksPage.jsx
  KitchenMenuTab.jsx
  KitchenDishCatalogTab.jsx
  KitchenPickCatalogDialog.jsx
  kitchenMenuQuantity.js
  kitchenMenuUiUtils.js

packages/shared/src/features/kitchen-books/api/kitchenBooksApi.js

apps/web/app/(private)/so-sach-bep-an/page.jsx
apps/superadmin/app/(private)/so-sach-bep-an/page.jsx   # nếu superadmin cần — mirror meal-roster
```

Nav: `navConfig.js` — icon `BookOpen` hoặc `ChefHat`, `routeAccessKey: "nav-kitchen-books"`.

`routeAccessRegistry.js` — `requiredPermissions: [PERMISSIONS.KITCHEN_BOOKS_ACCESS]`.

`nextAuthMiddleware.js` — thêm pathname `/so-sach-bep-an`.

## Pattern tham chiếu

| Concern | File mẫu |
|---------|----------|
| Page + tab + unit scope | `MealRosterPage.jsx` + `TargetUnitScopeContext` |
| Data scope logical → storage | `lttp.service.js`, `unit-data-scope.middleware.js` |
| Tìm LTTP | `IssueSlipCommoditySearch` |
| BE module | `lttp/` routes với `unitDataScopeMiddleware` |
| Permission seed | `permissions.js` + `permission-catalog.vi.js` |

## Lộ trình sau MVP

1. **Tổng hợp tháng** — rollup `totalQuantity` theo `commodityId` × tháng; đối chiếu phiếu xuất LTTP
2. **Xuất Sheets** — category mới trong `chung-tu-quyet-toan`, template TỔNG HỢP
3. Copy thực đơn ngày/buổi; đổi `calcMode` tay trên UI

## Kiểm thử

- Unit test `kitchen-books-quantity.js`: per_person g→kg, ml→L, shared ceil, headcount=0
- Unit test headcount: marks + extra split (fixtures nhỏ)
- Manual: chọn đơn vị có chấm cơm → quân số khớp; lưu/reload ngày/buổi
