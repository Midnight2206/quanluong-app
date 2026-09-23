# Signature System Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm `source: "system"` cho signature slots — tự động resolve tên/chức danh từ catalog code-defined lúc xuất PDF; mở rộng Profile với `rankFull`, `rankAbbr`, `department`.

**Architecture:** Catalog pattern — mỗi catalog node là 1 async resolver function trong code. Không lưu resolved value vào DB, chỉ resolve real-time lúc xuất. DB schema chỉ lưu `catalogNodeId` (string). `Profile.rank` migrate sang `rankFull`, thêm `rankAbbr` và `department`.

**Tech Stack:** Node.js ESM, Prisma, MySQL, React, TanStack Query, Zod

## Global Constraints

- Không thêm dependency mới
- ESM imports (`import`/`export`), không `require()`
- Prisma model names: PascalCase; JS field names: camelCase
- Nếu resolve catalog node thất bại → trả `null`, không throw
- Backward-compatible: `source: "static"` và `source: "prompt"` không thay đổi hành vi
- `Profile.rank` field vẫn giữ trong DB cho đến khi migration drop (Task 1 sẽ drop)

---

## File Map

| File | Tác động |
|------|---------|
| `prisma/schema.prisma` | Thêm `rankFull`, `rankAbbr`, `department` vào Profile; xóa `rank` |
| `prisma/migrations/*/migration.sql` | Auto-generated |
| `src/modules/chung-tu-quyet-toan/chung-tu-signature-catalog.js` | **Tạo mới** — catalog nodes + resolver |
| `src/modules/chung-tu-quyet-toan/chung-tu-signature-catalog.test.js` | **Tạo mới** — test resolvers |
| `src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.js` | Thêm `resolveSystemSlots()` helper, sửa `resolvePdfHeaderSettings()` |
| `src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.test.js` | Thêm test cho system slot resolve |
| `src/modules/chung-tu-quyet-toan/chung-tu-pdf-export.service.js` | Gọi `resolveSystemSlots()` trước khi build payload |
| `src/modules/chung-tu-quyet-toan/chung-tu-signature-settings.service.js` | Thêm `availableCatalogNodes` vào GET response |
| `src/modules/auth/me-profile.service.js` | Thêm `rankFull`, `rankAbbr`, `department` |
| `src/modules/auth/auth.mapper.js` | Map 3 fields mới |
| `src/modules/auth/auth.validator.js` | Thêm validation 3 fields mới |
| `src/modules/auth/auth-profile.test.js` | Test 3 fields mới |
| `packages/shared/src/pages/profile/ProfilePage.jsx` | UI: thay `rank` bằng 3 field |

---

## Task 1: DB Migration — Profile rank split + department

**Files:**
- Modify: `quanluong-app-be/prisma/schema.prisma`
- Auto-create: migration SQL

**Interfaces:**
- Produces: `Profile.rankFull`, `Profile.rankAbbr`, `Profile.department` — all `String?`
- `Profile.rank` removed from schema

- [ ] **Step 1: Sửa schema.prisma**

Trong `model Profile`, thay:
```prisma
rank        String?
```
bằng:
```prisma
rankFull     String?  @db.VarChar(128)
rankAbbr     String?  @db.VarChar(32)
department   String?  @db.VarChar(255)
```

- [ ] **Step 2: Tạo migration**

```bash
cd quanluong-app-be
npx prisma migrate dev --name profile-rank-split-add-department
```

Kiểm tra file migration vừa tạo có SQL:
- `ALTER TABLE Profile ADD COLUMN rankFull ...`
- `ALTER TABLE Profile ADD COLUMN rankAbbr ...`
- `ALTER TABLE Profile ADD COLUMN department ...`
- `UPDATE Profile SET rankFull = rank WHERE rank IS NOT NULL`
- `ALTER TABLE Profile DROP COLUMN rank`

Nếu Prisma không tự sinh UPDATE + DROP, mở file migration SQL, thêm tay trước `ALTER TABLE Profile DROP COLUMN rank`:
```sql
UPDATE `Profile` SET `rankFull` = `rank` WHERE `rank` IS NOT NULL;
```

- [ ] **Step 3: Verify migration chạy OK**

```bash
npx prisma db pull
npx prisma generate
```

Expected: không có lỗi, `Profile` trong schema không còn `rank`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): split Profile.rank into rankFull + rankAbbr, add department"
```

---

## Task 2: BE — Profile API update (rankFull, rankAbbr, department)

**Files:**
- Modify: `quanluong-app-be/src/modules/auth/me-profile.service.js`
- Modify: `quanluong-app-be/src/modules/auth/auth.mapper.js`
- Modify: `quanluong-app-be/src/modules/auth/auth.validator.js`
- Test: `quanluong-app-be/src/modules/auth/auth-profile.test.js`

**Interfaces:**
- Consumes: Task 1 (Prisma Profile model với rankFull, rankAbbr, department)
- Produces: Profile API trả `rankFull`, `rankAbbr`, `department`; PATCH `/me/profile` chấp nhận 3 field mới

- [ ] **Step 1: Viết test thất bại**

Trong `auth-profile.test.js`, thêm test:
```js
import { describe, it, expect, vi, beforeEach } from "vitest";
// (giả sử file đã có cấu trúc mock prisma — thêm vào test suite hiện tại)

describe("me-profile rankFull/rankAbbr/department", () => {
  it("upserts rankFull, rankAbbr, department correctly", async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ id: 1 });
    vi.doMock("../../infra/database/prisma/prisma.client.js", () => ({
      prisma: {
        user: { findUnique: vi.fn().mockResolvedValue({ id: 1, username: "u", profile: null }) },
        profile: { upsert: mockUpsert },
      },
    }));
    const { updateOwnProfile } = await import("./me-profile.service.js");
    await updateOwnProfile(1, { rankFull: "Thiếu tá", rankAbbr: "Th/tá", department: "Tài vụ" });
    const callData = mockUpsert.mock.calls[0][0].create;
    expect(callData.rankFull).toBe("Thiếu tá");
    expect(callData.rankAbbr).toBe("Th/tá");
    expect(callData.department).toBe("Tài vụ");
  });
});
```

- [ ] **Step 2: Chạy test để confirm thất bại**

```bash
cd quanluong-app-be
npx vitest run src/modules/auth/auth-profile.test.js
```

Expected: FAIL (rankFull không tồn tại trong upsert)

- [ ] **Step 3: Sửa me-profile.service.js**

Thay toàn bộ reference `rank` bằng `rankFull`, thêm `rankAbbr` và `department`:

```js
// trong prisma.profile.upsert create:
rankFull: data.rankFull ?? null,
rankAbbr: data.rankAbbr ?? null,
department: data.department ?? null,

// trong update block:
...(data.rankFull !== undefined ? { rankFull: data.rankFull } : {}),
...(data.rankAbbr !== undefined ? { rankAbbr: data.rankAbbr } : {}),
...(data.department !== undefined ? { department: data.department } : {}),
```

Xóa mọi reference `rank` cũ.

- [ ] **Step 4: Sửa auth.mapper.js**

```js
// thay:
rank: user.profile.rank,
// bằng:
rankFull: user.profile.rankFull,
rankAbbr: user.profile.rankAbbr,
department: user.profile.department,
```

- [ ] **Step 5: Sửa auth.validator.js**

```js
// thay:
rank: z.string().max(255).optional().nullable(),
// bằng:
rankFull: z.string().max(128).optional().nullable(),
rankAbbr: z.string().max(32).optional().nullable(),
department: z.string().max(255).optional().nullable(),
```

- [ ] **Step 6: Chạy test để confirm pass**

```bash
npx vitest run src/modules/auth/auth-profile.test.js
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/auth/
git commit -m "feat(profile): add rankFull, rankAbbr, department — replace rank"
```

---

## Task 3: BE — Signature Catalog

**Files:**
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-signature-catalog.js`
- Create: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-signature-catalog.test.js`

**Interfaces:**
- Consumes: Task 1 (Profile.rankAbbr, Profile.department), `prisma.lttpUnitIssueFormDefaults`
- Produces:
  - `SIGNATURE_CATALOG` — object keyed by node ID
  - `getCatalogNodesForCategory(categoryKey)` → `Array<{ id, label }>`
  - Each node: `{ label, applicableTo, resolve(ctx) → Promise<{name,title}|null> }`

- [ ] **Step 1: Viết test thất bại**

Tạo `chung-tu-signature-catalog.test.js`:
```js
import { describe, it, expect, vi } from "vitest";

const mockPrisma = {
  lttpUnitIssueFormDefaults: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
};

vi.mock("../../infra/database/prisma/prisma.client.js", () => ({ prisma: mockPrisma }));

const { SIGNATURE_CATALOG, getCatalogNodesForCategory } = await import(
  "./chung-tu-signature-catalog.js"
);

describe("SIGNATURE_CATALOG", () => {
  it("bkmh.nguoiMua resolves name from buyer profile", async () => {
    mockPrisma.lttpUnitIssueFormDefaults.findUnique.mockResolvedValue({
      defaultBuyerUser: {
        profile: { fullName: "Nguyễn Văn A", rankAbbr: "Th/tá", department: "Tài vụ" },
      },
    });
    const result = await SIGNATURE_CATALOG["bkmh.nguoiMua"].resolve({
      storageUnitId: 1,
      prisma: mockPrisma,
    });
    expect(result).toEqual({ name: "Th/tá Nguyễn Văn A", title: "Tài vụ" });
  });

  it("bkmh.nguoiMua returns null if no buyer user", async () => {
    mockPrisma.lttpUnitIssueFormDefaults.findUnique.mockResolvedValue(null);
    const result = await SIGNATURE_CATALOG["bkmh.nguoiMua"].resolve({
      storageUnitId: 1,
      prisma: mockPrisma,
    });
    expect(result).toBeNull();
  });

  it("profile.currentUser resolves from current user profile", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      profile: { fullName: "Trần Thị B", rankAbbr: "Đ/tá", department: "Hành chính" },
    });
    const result = await SIGNATURE_CATALOG["profile.currentUser"].resolve({
      currentUserId: 5,
      prisma: mockPrisma,
    });
    expect(result).toEqual({ name: "Đ/tá Trần Thị B", title: "Hành chính" });
  });

  it("getCatalogNodesForCategory filters by applicableTo", () => {
    const nodes = getCatalogNodesForCategory("bang-ke-mua-hang");
    expect(nodes.some((n) => n.id === "bkmh.nguoiMua")).toBe(true);
    expect(nodes.some((n) => n.id === "profile.currentUser")).toBe(true);
  });

  it("getCatalogNodesForCategory returns currentUser for non-bkmh", () => {
    const nodes = getCatalogNodesForCategory("phieu-xuat-kho");
    expect(nodes.some((n) => n.id === "bkmh.nguoiMua")).toBe(false);
    expect(nodes.some((n) => n.id === "profile.currentUser")).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy test để confirm thất bại**

```bash
npx vitest run src/modules/chung-tu-quyet-toan/chung-tu-signature-catalog.test.js
```

Expected: FAIL (module không tồn tại)

- [ ] **Step 3: Tạo chung-tu-signature-catalog.js**

```js
import { prisma as defaultPrisma } from "../../infra/database/prisma/prisma.client.js";

export const SIGNATURE_CATALOG = {
  "bkmh.nguoiMua": {
    label: "Người mua (BKMH)",
    applicableTo: ["bang-ke-mua-hang"],
    resolve: async ({ storageUnitId, prisma = defaultPrisma } = {}) => {
      const defaults = await prisma.lttpUnitIssueFormDefaults.findUnique({
        where: { unitId: Number(storageUnitId) },
        include: {
          defaultBuyerUser: {
            select: {
              profile: { select: { fullName: true, rankAbbr: true, department: true } },
            },
          },
        },
      });
      const profile = defaults?.defaultBuyerUser?.profile;
      if (!profile?.fullName) return null;
      const name = [profile.rankAbbr, profile.fullName].filter(Boolean).join(" ");
      return { name, title: profile.department ?? null };
    },
  },

  "profile.currentUser": {
    label: "Người dùng hiện tại",
    applicableTo: ["*"],
    resolve: async ({ currentUserId, prisma = defaultPrisma } = {}) => {
      const user = await prisma.user.findUnique({
        where: { id: Number(currentUserId) },
        select: {
          profile: { select: { fullName: true, rankAbbr: true, department: true } },
        },
      });
      const profile = user?.profile;
      if (!profile?.fullName) return null;
      const name = [profile.rankAbbr, profile.fullName].filter(Boolean).join(" ");
      return { name, title: profile.department ?? null };
    },
  },
};

/**
 * Trả danh sách catalog nodes áp dụng cho loại chứng từ.
 * @param {string} categoryKey
 * @returns {{ id: string, label: string }[]}
 */
export function getCatalogNodesForCategory(categoryKey) {
  return Object.entries(SIGNATURE_CATALOG)
    .filter(([, node]) => node.applicableTo.includes("*") || node.applicableTo.includes(categoryKey))
    .map(([id, node]) => ({ id, label: node.label }));
}
```

- [ ] **Step 4: Chạy test để confirm pass**

```bash
npx vitest run src/modules/chung-tu-quyet-toan/chung-tu-signature-catalog.test.js
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/chung-tu-quyet-toan/chung-tu-signature-catalog.js \
        src/modules/chung-tu-quyet-toan/chung-tu-signature-catalog.test.js
git commit -m "feat(chung-tu): add signature catalog with bkmh.nguoiMua and profile.currentUser nodes"
```

---

## Task 4: BE — Resolve system slots trong PDF export

**Files:**
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.test.js`
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-pdf-export.service.js`

**Interfaces:**
- Consumes: Task 3 — `SIGNATURE_CATALOG`
- Produces: 
  - `resolveSystemSignatureSlots(slots, ctx)` → `Promise<ResolvedSlot[]>`
  - `resolvePdfHeaderSettings()` — BKMH: `hoTenNguoiMua`/`boPhan` từ catalog thay vì từ `bkmhHeaderSettings`

**ResolvedSlot shape:**
```js
{
  label: string,
  source: "static" | "prompt" | "system",
  catalogNodeId?: string,
  staticName?: string,
  staticTitle?: string,
  // sau resolve:
  resolvedName: string | null,  // null nếu không resolve được
  resolvedTitle: string | null,
}
```

- [ ] **Step 1: Viết test thất bại**

Trong `chung-tu-data-resolver.service.test.js`, thêm:
```js
import { resolveSystemSignatureSlots } from "./chung-tu-data-resolver.service.js";

describe("resolveSystemSignatureSlots", () => {
  it("resolves system slots via catalog, passes through static/prompt unchanged", async () => {
    const mockCatalog = {
      "bkmh.nguoiMua": {
        resolve: vi.fn().mockResolvedValue({ name: "Th/tá A", title: "Tài vụ" }),
      },
    };
    const slots = [
      { label: "Người mua", source: "system", catalogNodeId: "bkmh.nguoiMua" },
      { label: "Thủ trưởng", source: "static", staticName: "B", staticTitle: "Chỉ huy" },
      { label: "Người nhận", source: "prompt" },
    ];
    const result = await resolveSystemSignatureSlots(slots, { storageUnitId: 1 }, mockCatalog);
    expect(result[0].resolvedName).toBe("Th/tá A");
    expect(result[0].resolvedTitle).toBe("Tài vụ");
    expect(result[1].resolvedName).toBeNull(); // static không có resolvedName
    expect(result[2].resolvedName).toBeNull(); // prompt không có resolvedName
  });

  it("returns null resolvedName when catalog node missing", async () => {
    const slots = [{ label: "X", source: "system", catalogNodeId: "nonexistent.node" }];
    const result = await resolveSystemSignatureSlots(slots, {}, {});
    expect(result[0].resolvedName).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test để confirm thất bại**

```bash
npx vitest run src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.test.js \
  --reporter=verbose 2>&1 | grep -E "FAIL|resolveSystem"
```

- [ ] **Step 3: Thêm resolveSystemSignatureSlots vào chung-tu-data-resolver.service.js**

Thêm import ở đầu file:
```js
import { SIGNATURE_CATALOG } from "./chung-tu-signature-catalog.js";
```

Thêm function (đặt trước `export`):
```js
/**
 * Resolve system slots via catalog. Static/prompt slots pass through with resolvedName=null.
 * @param {object[]} slots
 * @param {{ storageUnitId?: number, currentUserId?: number, prisma?: object }} ctx
 * @param {object} [catalog] - injectable for testing
 */
export async function resolveSystemSignatureSlots(slots, ctx, catalog = SIGNATURE_CATALOG) {
  if (!Array.isArray(slots)) return [];
  return Promise.all(
    slots.map(async (slot) => {
      if (slot?.source !== "system") {
        return { ...slot, resolvedName: null, resolvedTitle: null };
      }
      const node = catalog[slot.catalogNodeId];
      if (!node) return { ...slot, resolvedName: null, resolvedTitle: null };
      const result = await node.resolve(ctx).catch(() => null);
      return { ...slot, resolvedName: result?.name ?? null, resolvedTitle: result?.title ?? null };
    })
  );
}
```

- [ ] **Step 4: Sửa resolvePdfHeaderSettings() cho BKMH**

Trong `resolvePdfHeaderSettings()`, BKMH block hiện dùng `bkmhHeaderSettings?.hoTenNguoiMua`. Thêm parameter `resolvedBkmhBuyer` (pre-resolved từ catalog):

```js
export function resolvePdfHeaderSettings({
  mergedSettings,
  rawSettings,
  exportingUserProfile,
  categoryKey,
  bkmhHeaderSettings,
  slips,
  resolvedBkmhBuyer = null,  // thêm mới: { name, title } | null
}) {
  // ... existing code unchanged ...
  if (categoryKey !== CHUNG_TU_CATEGORY_KEYS.BANG_KE_MUA_HANG) {
    return resolved;
  }
  const settings = normalizePlainObject(rawSettings);
  // Ưu tiên: resolvedBkmhBuyer → slips → bkmhHeaderSettings (fallback cuối)
  const buyerName =
    resolvedBkmhBuyer?.name ||
    resolveNguoiMuaFromSlips(slips) ||
    normalizeText(bkmhHeaderSettings?.hoTenNguoiMua);
  const boPhan =
    resolvedBkmhBuyer?.title ||
    normalizeText(settings.boPhan) ||
    normalizeText(resolved.boPhan) ||
    normalizeText(bkmhHeaderSettings?.boPhan);
  return {
    ...resolved,
    signerNguoiMua: buyerName,
    hoTenNguoiMua: buyerName,
    nguoiMua: buyerName,
    boPhan,
  };
}
```

- [ ] **Step 5: Sửa chung-tu-pdf-export.service.js — gọi resolve trước khi build payload**

Thêm import:
```js
import { resolveSystemSignatureSlots } from "./chung-tu-data-resolver.service.js";
import { SIGNATURE_CATALOG } from "./chung-tu-signature-catalog.js";
```

Trong `createChungTuPdfExport()`, trước dòng `const fieldsPayload = await getTemplateFields(...)`:
```js
// Resolve system slots
const resolveCtx = { storageUnitId: unitId, currentUserId: createdById };
const resolvedSlots = signatureBlock?.slots
  ? await resolveSystemSignatureSlots(signatureBlock.slots, resolveCtx)
  : null;
const resolvedSignatureBlock = resolvedSlots
  ? { ...signatureBlock, slots: resolvedSlots }
  : signatureBlock;

// Resolve BKMH buyer cho header
const resolvedBkmhBuyer =
  categoryKey === "bang-ke-mua-hang"
    ? await SIGNATURE_CATALOG["bkmh.nguoiMua"]
        .resolve({ storageUnitId: unitId })
        .catch(() => null)
    : null;
```

Sau đó truyền `resolvedBkmhBuyer` vào `resolvePdfHeaderSettings` (tìm call site trong service, thêm field).

Và thay `signatureBlock` bằng `resolvedSignatureBlock` khi truyền vào `buildDocumentServicePayload`.

- [ ] **Step 6: Chạy test**

```bash
npx vitest run src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.test.js
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.js \
        src/modules/chung-tu-quyet-toan/chung-tu-data-resolver.service.test.js \
        src/modules/chung-tu-quyet-toan/chung-tu-pdf-export.service.js
git commit -m "feat(chung-tu): resolve system signature slots at PDF export time"
```

---

## Task 5: BE — Signature settings GET trả availableCatalogNodes

**Files:**
- Modify: `quanluong-app-be/src/modules/chung-tu-quyet-toan/chung-tu-signature-settings.service.js`

**Interfaces:**
- Consumes: Task 3 — `getCatalogNodesForCategory`
- Produces: GET signature settings response thêm field `availableCatalogNodes: [{id, label}]`

- [ ] **Step 1: Sửa chung-tu-signature-settings.service.js**

Thêm import:
```js
import { getCatalogNodesForCategory } from "./chung-tu-signature-catalog.js";
```

Sửa `mapSignatureSettingsRow`:
```js
function mapSignatureSettingsRow(row, categoryKey) {
  if (!row) return null;
  return {
    id: row.id,
    categoryKey: row.categoryKey,
    signatureBlock:
      row.signatureBlockJson && typeof row.signatureBlockJson === "object"
        ? row.signatureBlockJson
        : {},
    availableCatalogNodes: getCatalogNodesForCategory(categoryKey ?? row.categoryKey),
    updatedById: row.updatedById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
```

Truyền `categoryKey` vào call của `mapSignatureSettingsRow`:
```js
// trong getChungTuSignatureSettings:
return mapSignatureSettingsRow(row, categoryKey);
// trong upsertChungTuSignatureSettings:
return mapSignatureSettingsRow(row, categoryKey);
```

- [ ] **Step 2: Manual test**

```bash
# Trong docker container app:
curl -s -H "Authorization: Bearer <token>" \
  http://localhost:3000/chungtuquyettoan/signature-settings/bang-ke-mua-hang | jq '.availableCatalogNodes'
```

Expected:
```json
[
  { "id": "bkmh.nguoiMua", "label": "Người mua (BKMH)" },
  { "id": "profile.currentUser", "label": "Người dùng hiện tại" }
]
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/chung-tu-quyet-toan/chung-tu-signature-settings.service.js
git commit -m "feat(chung-tu): return availableCatalogNodes in signature settings GET"
```

---

## Task 6: FE — Profile page: thêm rankFull, rankAbbr, department

**Files:**
- Modify: `packages/shared/src/pages/profile/ProfilePage.jsx`

**Interfaces:**
- Consumes: Task 2 — API trả `rankFull`, `rankAbbr`, `department`
- Produces: Profile page có 3 ô mới thay cho ô `rank` cũ

- [ ] **Step 1: Sửa ProfilePage.jsx**

Tìm và thay:
```js
// form defaults (useState/useForm):
rank: "",
// → thay bằng:
rankFull: "",
rankAbbr: "",
department: "",
```

```js
// populate từ API response:
rank: user.profile?.rank || "",
// → thay bằng:
rankFull: user.profile?.rankFull || "",
rankAbbr: user.profile?.rankAbbr || "",
department: user.profile?.department || "",
```

```js
// submit payload:
rank: values.rank?.trim() || null,
// → thay bằng:
rankFull: values.rankFull?.trim() || null,
rankAbbr: values.rankAbbr?.trim() || null,
department: values.department?.trim() || null,
```

Tìm input `rank` trong JSX, thay bằng 3 field:
```jsx
{/* Cấp bậc */}
<div className="grid grid-cols-2 gap-3">
  <div>
    <label className={labelClass}>Cấp bậc đầy đủ</label>
    <input className={fieldClass} placeholder="Vd: Thiếu tá" {...regProfile("rankFull")} />
  </div>
  <div>
    <label className={labelClass}>Viết tắt</label>
    <input className={fieldClass} placeholder="Vd: Th/tá" {...regProfile("rankAbbr")} />
  </div>
</div>
<div>
  <label className={labelClass}>Bộ phận</label>
  <input className={fieldClass} {...regProfile("department")} />
</div>
```

- [ ] **Step 2: Verify thủ công trong browser**

Mở Profile page, kiểm tra:
- 3 field hiện đúng vị trí
- Lưu và reload lại — dữ liệu persist

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/pages/profile/ProfilePage.jsx
git commit -m "feat(profile-fe): replace rank with rankFull, rankAbbr, department fields"
```

---

## Task 7: FE — Signature slot editor: thêm option "Lấy từ hệ thống"

**Files:**
- Tìm component signature slot editor trong FE (grep `signatureBlock` / `SignatureBlock` / `SlotEditor`)
- Modify: component đó

**Interfaces:**
- Consumes: Task 5 — `availableCatalogNodes` từ signature settings API

- [ ] **Step 1: Tìm component**

```bash
grep -r "signatureBlock\|SlotEditor\|SignatureSlot\|source.*static\|source.*prompt" \
  packages/shared/src --include="*.jsx" --include="*.tsx" -l
```

- [ ] **Step 2: Thêm option "Lấy từ hệ thống" vào source selector**

Trong component slot editor, tìm chỗ render select/radio cho `source`. Thêm option:
```jsx
<option value="system">Lấy từ hệ thống</option>
```

Khi `source === "system"`, hiện dropdown chọn `catalogNodeId`:
```jsx
{slot.source === "system" && (
  <select
    value={slot.catalogNodeId ?? ""}
    onChange={(e) => onChange({ ...slot, catalogNodeId: e.target.value })}
  >
    <option value="">-- Chọn nguồn --</option>
    {availableCatalogNodes.map((n) => (
      <option key={n.id} value={n.id}>{n.label}</option>
    ))}
  </select>
)}
```

`availableCatalogNodes` lấy từ signature settings API response (đã có từ Task 5).

- [ ] **Step 3: Verify thủ công**

Mở Settings → Chữ ký → thêm slot → chọn "Lấy từ hệ thống" → dropdown xuất hiện với catalog nodes.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/
git commit -m "feat(chung-tu-fe): add system source option to signature slot editor"
```

---

## Task 8: FE — BKMH Header settings UI cleanup

**Files:**
- Tìm component BKMH Header settings (grep `hoTenNguoiMua\|ChungTuBkmhHeader`)

**Interfaces:**
- Không cần thêm API — chỉ xóa ô nhập tay, thêm text mô tả

- [ ] **Step 1: Tìm component**

```bash
grep -r "hoTenNguoiMua\|BkmhHeader\|bkmh.*header\|bkmh-header" \
  packages/shared/src --include="*.jsx" --include="*.tsx" -l
```

- [ ] **Step 2: Xóa inputs, thêm mô tả**

Xóa input `hoTenNguoiMua` và `boPhan` (và các label, form state tương ứng). Thay bằng:
```jsx
<p className="text-sm text-muted-foreground">
  Họ tên và bộ phận người mua sẽ được lấy tự động từ cài đặt người mua của đơn vị khi xuất PDF.
</p>
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/
git commit -m "feat(bkmh-fe): remove manual header inputs, auto-resolved from catalog"
```

---

## Self-Review Checklist

- [x] **T1 migration:** migrate `rank` → `rankFull`, thêm `rankAbbr`, `department`
- [x] **T2 API profile:** service + mapper + validator + test
- [x] **T3 catalog:** 2 nodes, `getCatalogNodesForCategory`, test đầy đủ
- [x] **T4 resolve:** `resolveSystemSignatureSlots` + `resolvePdfHeaderSettings` với `resolvedBkmhBuyer` + pdf-export wiring
- [x] **T5 GET:** `availableCatalogNodes` trong signature settings response
- [x] **T6 FE profile:** 3 field mới
- [x] **T7 FE slot editor:** option "Lấy từ hệ thống" + catalog dropdown
- [x] **T8 FE BKMH header:** xóa ô nhập tay
- [x] **Backward-compat:** `static`/`prompt` slots không bị ảnh hưởng
- [x] **Fallback:** catalog resolve fail → null, không throw
- [x] **Spec coverage:** tất cả locked decisions phản ánh trong tasks
