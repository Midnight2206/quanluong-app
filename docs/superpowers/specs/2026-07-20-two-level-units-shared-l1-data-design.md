# Đơn vị 2 cấp + kho dùng chung cấp 1

Ngày: 2026-07-20

## Mục tiêu

Chuyển mô hình tổ chức từ cây nhiều cấp + đồng bộ/fork xuống đơn vị con sang:

1. **Chỉ 2 cấp đơn vị** (cấp 1 / cấp 2)
2. **Ba loại dữ liệu dùng chung trong nhánh cấp 1**: mặt hàng LTTP, bảng giá LTTP, chức danh
3. **Cấp 2 chỉ đọc** 3 loại đó; cấp 1 mới ghi
4. **Bỏ hoàn toàn** cơ chế đồng bộ đơn vị con (UI + API apply-down / fork nghiệp vụ)
5. **Chỉ đơn vị cấp 1** được tạo tài khoản `admin`
6. Dữ liệu 3 loại đang gắn **cấp con**: **xóa** (không migrate lên cấp 1)

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Độ sâu cây | `UNITS_MAX_TREE_DEPTH = 2` → `depth` chỉ `0` (cấp 1) hoặc `1` (cấp 2) |
| Kho 3 loại dữ liệu | Luôn gắn `unitId` = **đơn vị cấp 1** của nhánh |
| Quyền ghi 3 loại | Chỉ user thao tác trong ngữ cảnh **cấp 1** (có permission tương ứng) |
| Quyền đọc 3 loại | Cấp 1 và cấp 2 trong cùng nhánh, nếu có permission |
| Đồng bộ / fork | **Xóa** tab dashboard + API apply-down; không còn clone nghiệp vụ mới |
| Dữ liệu cũ ở cấp 2 | **Không gộp lên cấp 1** — **xóa** 3 loại dữ liệu đang gắn đơn vị cấp con (`depth >= 1`) |
| Admin | `type = admin` chỉ khi `unit.depth === 0` |
| Loại dữ liệu khác | Phiếu xuất, sổ chấm cơm, kitchen, chứng từ… **không đổi** trong spec này (vẫn theo rule hiện tại) |

## Mô hình đơn vị

```
Cấp 1 (depth 0)          ← kho LTTP / giá / chức danh sống ở đây
 └── Cấp 2 (depth 1)     ← user cấp 2 đọc kho cấp 1; không tạo admin
```

- Tạo đơn vị con chỉ hợp lệ khi `parent.depth === 0`
- Reparent không được tạo `depth > 1` hoặc đẩy subtree vượt trần
- FE (SuperadminUnitsPanel): parent picker chỉ liệt kê đơn vị `depth === 0`

**Cây sâu hơn 2 cấp đang có trong DB:** ngoài chặn tạo mới, migration/script flatten (đưa mọi `depth >= 2` lên làm con trực tiếp của root nhánh cấp 1 gần nhất, hoặc báo cáo + fail nếu không an toàn) — chi tiết ở mục Migration.

## Scope dữ liệu — 3 loại dùng chung

### Khái niệm

| Khái niệm | Vai trò |
|-----------|---------|
| `logicalUnitId` | Đơn vị đang chọn trên UI / `X-Target-Unit-Id` |
| `storageUnitId` (cho 3 loại) | Luôn = **ancestor cấp 1** (`depth 0`) của `logicalUnitId`; nếu chính nó là cấp 1 thì = chính nó |

### Resolve storage

Thay / bổ sung resolve hiện tại (`INDEPENDENT` / `INHERIT_PRIVATE` / share grant) **cho 3 kind**:

- `LTTP_COMMODITY`
- `LTTP_PRICE_TABLE`
- `JOB_TITLE`

Quy tắc mới (ưu tiên rõ ràng hơn fork/grant cho 3 kind này):

```
storageUnitId = rootLevel1UnitId(logicalUnitId)
```

Trong đó `rootLevel1UnitId`:

- nếu `unit.depth === 0` → `unit.id`
- nếu `unit.depth === 1` → `unit.parentId` (phải là cấp 1)
- nếu `depth > 1` (dữ liệu legacy trước flatten) → leo `parentId` tới `depth === 0`

### Đọc / ghi

| Hành động | Cấp 1 | Cấp 2 |
|-----------|-------|-------|
| List / get 3 loại (trong nhánh) | Có (nếu có permission) | Có (nếu có permission) |
| Create / update / delete 3 loại | Có (nếu có permission) | **403** — chỉ đọc |

Ghi luôn persist với `unitId = storageUnitId` (cấp 1).

Kitchen books / phiếu xuất vẫn validate commodity thuộc `storageUnitId` LTTP — sau thay đổi này, kho LTTP của cả nhánh là một, khớp mục tiêu “dùng chung”.

### Private share grant & UnitEntityFork

- **Không** dùng grant/fork làm đường chính cho 3 loại nữa
- API create private-share cho các kind này: deprecate hoặc reject với message rõ
- Bản ghi `UnitEntityFork` của 3 kind: dọn sau khi xóa dữ liệu cấp con

## Bỏ đồng bộ đơn vị con

### Frontend

- Xóa tab `unit-downstream-sync` khỏi `dashboardTabMeta.js`
- Xóa page `apps/web/.../unit-downstream-sync/`
- Xóa / ngắt `DashboardUnitDownstreamSyncPage`, `AdminUnitDataSharePanel` nếu không còn caller
- Xóa key `dashboard-unit-downstream-sync` khỏi `routeAccessRegistry.js`
- Gỡ copy hướng dẫn “Đồng bộ đơn vị con” trên panel LTTP / liên quan

### Backend

- Xóa hoặc disable routes:
  - `POST /api/job-titles/:id/apply-to-unit`
  - `POST /api/lttp/commodities/:id/apply-to-unit`
  - `POST /api/lttp/price-tables/:id/apply-to-unit`
- Xóa permission `*.applyDown` khỏi catalog + sync permissions (hoặc giữ code nhưng không expose route — ưu tiên **xóa sạch** route + permission sync)
- Service `apply*ToDescendantUnit`: xóa hoặc để dead-code-free

`UnitEntityFork` model có thể giữ trong schema tạm để script dọn đọc/xóa row, hoặc drop sau (YAGNI: không bắt buộc drop schema trong cùng PR).

## Admin chỉ ở cấp 1

Trong `users.service` (create / patch / replace):

- Nếu `type.name === "admin"` và đơn vị gán có `depth !== 0` → **400/403** với message rõ (VD: “Chỉ đơn vị cấp 1 được gán tài khoản admin”)
- `superadmin` không gắn rule này theo `unitId` nghiệp vụ (giữ hành vi hiện tại của hệ thống)
- FE: ẩn option type `admin` khi đang tạo user cho đơn vị cấp 2 (UX; BE vẫn là nguồn sự thật)

User admin **đã tồn tại** ở cấp 2: migration báo cáo danh sách; mặc định **không tự đổi type** — admin vận hành xử lý tay, trừ khi implement chọn harden (block login / force demote). Spec mặc định: **chỉ chặn tạo/sửa mới**; kèm script liệt kê vi phạm.

## Cleanup dữ liệu (không migrate)

Script một lần (Node + Prisma), chạy trước hoặc cùng deploy. **Không** chuyển bản ghi cấp con lên cấp 1.

### A. Flatten cây (nếu còn depth ≥ 2)

1. Với mỗi unit `depth >= 2`: tìm ancestor `depth === 0` gần nhất
2. Set `parentId =` ancestor đó (thành cấp 2 trực tiếp), rồi `rebuildAllUnitPaths`
3. Nếu conflict nghiệp vụ → log + fail an toàn thay vì đoán

### B. Xóa 3 loại dữ liệu của đơn vị cấp con

Với mọi unit có `depth >= 1` (sau flatten: mọi cấp 2):

1. **JobTitle** thuộc `unitId` đó:
   - `User.jobTitleId` → `SetNull` (schema đã hỗ trợ) hoặc clear trước khi xóa
   - Xóa `JobTitle` (+ permissions cascade)
2. **LttpPriceTable** thuộc `unitId` đó:
   - Xóa bảng giá (rows cascade)
3. **LttpCommodity** thuộc `unitId` đó:
   - Các FK `onDelete: Restrict` (dòng phiếu xuất, kitchen, price row còn sót…) phải được **xóa/cắt trước** trong cùng transaction theo thứ tự an toàn, rồi mới xóa commodity
   - **Không** remap sang commodity cấp 1
4. Xóa `UnitEntityFork` (và share grant liên quan 3 kind nếu còn) có `sourceUnitId` / `targetUnitId` là đơn vị cấp con, hoặc kind thuộc 3 loại trên gắn unit cấp con

**Hệ quả chấp nhận được theo yêu cầu nghiệp vụ:** dữ liệu 3 loại ở cấp con mất hẳn; phiếu/kitchen/… của cấp con nếu từng phụ thuộc commodity cấp con sẽ mất dòng liên quan (hoặc script fail + report nếu không xóa hết được). Dữ liệu 3 loại của **cấp 1** giữ nguyên.

### C. Báo cáo

In summary: số unit flatten, số JobTitle / PriceTable / Commodity đã xóa theo unit cấp con, số FK phụ thuộc đã cắt, danh sách admin cấp 2 còn lại, mọi lỗi skip/fail.

## Kiểm thử / chấp nhận

1. Tạo đơn vị con dưới cấp 2 → **bị từ chối**
2. User cấp 1 CRUD LTTP / giá / chức danh → OK; bản ghi `unitId` = cấp 1
3. User cấp 2 list cùng dữ liệu kho cấp 1 → OK; create/update/delete → **403**
4. Tab “Đồng bộ đơn vị con” không còn trên dashboard
5. API apply-to-unit → **404** hoặc đã gỡ
6. Tạo user `admin` gắn đơn vị cấp 2 → **bị từ chối**; cấp 1 → OK
7. Sau cleanup: không còn commodity / jobTitle / priceTable gắn unit `depth >= 1`

## Ngoài phạm vi

- Gộp/migrate dữ liệu 3 loại từ cấp 2 lên cấp 1
- Đổi scope meal roster / chứng từ / kitchen sang mô hình khác
- Soft-delete đơn vị
- Đồng bộ ngang giữa hai nhánh cấp 1 khác nhau
- Tự động demote admin cấp 2 hiện có
- Drop hẳn bảng `UnitEntityFork` / `UnitPrivateDataShareGrant` trong cùng đợt (có thể phase 2)

## Rủi ro

| Rủi ro | Giảm thiểu |
|--------|------------|
| Mất dữ liệu 3 loại ở cấp con | Đúng yêu cầu; backup DB trước khi chạy script |
| Phiếu/kitchen cấp con trỏ commodity cấp con | Xóa/cắt FK Restrict trước; report số dòng bị ảnh hưởng |
| Unit sâu hơn 2 cấp | Flatten có kiểm soát + rebuild path |
| FE vẫn gọi apply-down | Xóa UI + route; mutation hooks chết theo |
| User cấp 2 mất quyền ghi bất ngờ | Đúng spec; thông báo release note |
