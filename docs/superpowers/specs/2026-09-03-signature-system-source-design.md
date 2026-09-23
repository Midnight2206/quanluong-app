# Design Spec: Signature System Source & Profile Extensions

**Date:** 2026-09-03  
**Status:** Approved  
**Feature:** Lấy chữ ký từ hệ thống (system-resolved signature slots)

---

## 1. Problem

Hiện tại signature slots chỉ hỗ trợ:
- `static` — tên nhập tay cố định
- `prompt` — nhập lúc in

Cần thêm `system` — tự động resolve từ dữ liệu hệ thống lúc xuất PDF.

Header fields `hoTenNguoiMua` / `boPhan` của BKMH hiện nhập tay qua `ChungTuBkmhHeaderSettings`, cũng cần auto-resolve.

---

## 2. Locked Decisions

| # | Quyết định |
|---|-----------|
| 1 | Catalog chung cho mọi loại chứng từ, fields từ code (không từ DB) |
| 2 | `Profile.rank` split thành `rankFull` + `rankAbbr`, migrate data cũ sang `rankFull` |
| 3 | Tên resolve **lúc xuất PDF** (real-time), không preview trước |
| 4 | Nếu không resolve được → **để trống** (không lỗi, không fallback) |
| 5 | Chữ ký trong slot system = `rankAbbr + " " + fullName` |

---

## 3. DB Changes

### 3.1 Profile model

```prisma
model Profile {
  // thêm mới:
  rankFull     String?  @db.VarChar(128)  // cấp bậc đầy đủ (vd: "Thiếu tá")
  rankAbbr     String?  @db.VarChar(32)   // viết tắt (vd: "Th/tá")
  department   String?  @db.VarChar(255)  // bộ phận

  // xóa:
  // rank String?  ← migrate sang rankFull, trường cũ drop sau migration
}
```

Migration: copy `rank` → `rankFull`, set `rankAbbr = null`, drop `rank`.

### 3.2 ChungTuSignatureSettings — signatureBlockJson schema

`signatureBlockJson.slots[]` thêm fields:

```ts
interface SignatureSlot {
  label: string;
  source: "static" | "prompt" | "system";  // thêm "system"
  // source === "system":
  catalogNodeId?: string;   // vd: "bkmh.nguoiMua"
  // source === "static":
  staticName?: string;
  staticTitle?: string;
}
```

Schema cũ (`static` / `prompt`) không thay đổi cấu trúc, backward-compatible.

### 3.3 ChungTuBkmhHeaderSettings — deprecated fields

`hoTenNguoiMua` và `boPhan` không còn nhập tay. Các field này vẫn giữ trong DB (không drop) nhưng backend **không đọc** chúng nữa — thay bằng resolve từ catalog node `bkmh.nguoiMua` lúc xuất.

> ponytail: Không drop column vội, giữ để rollback an toàn.

---

## 4. Signature Catalog (code-defined)

**File:** `src/modules/chung-tu-quyet-toan/chung-tu-signature-catalog.js`

```js
/**
 * Catalog node resolver nhận context và trả { name, title } hoặc null.
 * name  → hiển thị trong khung chữ ký
 * title → chức danh bên dưới
 */
export const SIGNATURE_CATALOG = {
  "bkmh.nguoiMua": {
    label: "Người mua (BKMH)",
    applicableTo: ["bang-ke-mua-hang"],  // filter FE dropdown
    resolve: async ({ storageUnitId, prisma }) => {
      const defaults = await prisma.lttpUnitIssueFormDefaults.findUnique({
        where: { unitId: storageUnitId },
        include: {
          defaultBuyerUser: {
            select: {
              profile: {
                select: { fullName: true, rankAbbr: true, department: true }
              }
            }
          }
        }
      });
      const profile = defaults?.defaultBuyerUser?.profile;
      if (!profile?.fullName) return null;
      const name = [profile.rankAbbr, profile.fullName].filter(Boolean).join(" ");
      return { name, title: profile.department ?? null };
    }
  },

  "profile.currentUser": {
    label: "Người dùng hiện tại",
    applicableTo: ["*"],
    resolve: async ({ currentUserId, prisma }) => {
      const user = await prisma.user.findUnique({
        where: { id: currentUserId },
        select: {
          profile: {
            select: { fullName: true, rankAbbr: true, department: true }
          }
        }
      });
      const profile = user?.profile;
      if (!profile?.fullName) return null;
      const name = [profile.rankAbbr, profile.fullName].filter(Boolean).join(" ");
      return { name, title: profile.department ?? null };
    }
  }
};
```

---

## 5. PDF Export — Resolve Flow

Trong `chung-tu-pdf-export.service.js`, trước khi gọi document service:

```js
async function resolveSignatureSlots(slots, ctx) {
  return Promise.all(slots.map(async (slot) => {
    if (slot.source !== "system") return slot;
    const node = SIGNATURE_CATALOG[slot.catalogNodeId];
    if (!node) return { ...slot, resolvedName: null, resolvedTitle: null };
    const result = await node.resolve(ctx).catch(() => null);
    return { ...slot, resolvedName: result?.name ?? null, resolvedTitle: result?.title ?? null };
  }));
}
```

Context `ctx` truyền vào: `{ storageUnitId, currentUserId, prisma }`.

Sau resolve, `resolvedName` / `resolvedTitle` được dùng thay `staticName` / `staticTitle` khi build payload gửi document service.

### BKMH Header auto-resolve

Khi build header data cho BKMH PDF:
- `hoTenNguoiMua` → resolve từ `SIGNATURE_CATALOG["bkmh.nguoiMua"]` → lấy `name`
- `boPhan` → lấy `title` từ cùng resolve call
- Nếu null → trường để trống (không dùng fallback từ DB)

---

## 6. API Changes

### 6.1 Không thêm endpoint mới

Catalog nodes trả về qua endpoint GET signature settings hiện tại — thêm field `availableCatalogNodes`:

```
GET /chungtuquyettoan/signature-settings/:categoryKey
→ thêm vào response:
{
  availableCatalogNodes: [
    { id: "bkmh.nguoiMua", label: "Người mua (BKMH)" },
    { id: "profile.currentUser", label: "Người dùng hiện tại" }
  ]
}
```

Filter theo `applicableTo` dựa vào `categoryKey`.

### 6.2 ChungTuBkmhHeaderSettings PUT

Xóa `hoTenNguoiMua` và `boPhan` khỏi payload — không accept nữa (ignored nếu gửi lên).

---

## 7. Frontend Changes

### 7.1 Profile page

Thay `rank` (1 ô) bằng 3 ô:
- `rankFull` — "Cấp bậc đầy đủ" (vd: Thiếu tá)
- `rankAbbr` — "Viết tắt" (vd: Th/tá)
- `department` — "Bộ phận"

### 7.2 Signature Settings UI — slot editor

Option `source`:
- "Nhập khi in" (`prompt`)
- "Cố định" (`static`) → hiện ô nhập tên + chức danh
- "Lấy từ hệ thống" (`system`) → hiện dropdown `availableCatalogNodes`

### 7.3 BKMH Header Settings UI

Xóa ô nhập `hoTenNguoiMua` và `boPhan`. Thay bằng text mô tả:
> "Họ tên và bộ phận người mua sẽ được lấy tự động từ cài đặt người mua của đơn vị khi xuất PDF."

### 7.4 Buyer Settings Modal

Mở rộng modal cài đặt người mua (đã có yêu cầu trước, thực hiện cùng task này):
- Layout 2 cột
- Hiển thị thông tin user được chọn: `rankAbbr + fullName`, `department`
- Preview "Chữ ký sẽ hiển thị: Th/tá Nguyễn Văn A"

---

## 8. Implementation Tasks

| Task | Mô tả | Layer |
|------|-------|-------|
| T1 | Prisma migration: `Profile` split `rank` → `rankFull` + `rankAbbr` + `department` | DB |
| T2 | Tạo `chung-tu-signature-catalog.js` với 2 nodes | BE |
| T3 | Sửa `chung-tu-pdf-export.service.js`: resolve system slots trước khi gọi doc service | BE |
| T4 | Sửa BKMH header build: auto-resolve `hoTenNguoiMua`/`boPhan` từ catalog | BE |
| T5 | GET signature settings: thêm `availableCatalogNodes` vào response | BE |
| T6 | Profile API: thêm `rankFull`, `rankAbbr`, `department` vào CRUD | BE |
| T7 | Profile page FE: thêm 3 field mới | FE |
| T8 | Signature slot editor FE: thêm option "Lấy từ hệ thống" + dropdown | FE |
| T9 | BKMH Header settings FE: xóa ô nhập tay, thêm mô tả | FE |
| T10 | Buyer settings modal FE: mở rộng UI, hiện preview chữ ký | FE |

---

## 9. Out of Scope

- Thêm catalog node mới ngoài 2 node trên (làm sau nếu cần)
- Preview real-time "chữ ký sẽ là gì" trong PDF wizard (resolve chỉ lúc xuất)
- Validation chặt nếu catalog node không tồn tại (trả null, không lỗi)
