---
name: quanluong-data-context
description: Data context for the Quân lương MariaDB kitchen books. Use when querying units, mức ăn, LTTP food groups, phiếu xuất kho, or the sổ nhập xuất ledger, and whenever explaining how tồn is computed. SQL is MariaDB 11.4, not a cloud warehouse dialect.
---

# Quân lương data context

Generated from the Prisma schema and `quanluong-app-be/src/modules/kitchen-books/`, using the data-context-extractor shape (entities, terms, filters, metrics). The database is **MariaDB 11.4**. Prisma's provider is `mysql`. There is no database MCP in this repo; write SQL for a person to run, or use the app's existing services.

For generic warehouse syntax, `sql-queries` and `write-query` still apply. For this database, follow the dialect below and the existing `mysql-patterns` skill. Do not emit `DATE_TRUNC`, `ILIKE`, `QUALIFY`, `SAFE_DIVIDE`, or backtick project.dataset.table names.

## SQL dialect: MariaDB 11.4

- Quote camelCase columns with backticks: `` `sortOrder` ``, `` `issueDate` ``, `` `unitId` ``.
- Booleans are `TINYINT(1)`. Filter with `= 1` / `= 0`.
- Dates: `CURDATE()`, `DATE_SUB(d, INTERVAL 1 DAY)`, `DATE_ADD`, `DATE_FORMAT(d, '%Y-%m')`, `DATE_FORMAT(d, '%m%y')` for sổ `bookMmyy`.
- `utf8mb4_unicode_ci` makes `LIKE` case-insensitive for these tables.
- Pages: `LIMIT :limit OFFSET :offset`.
- JSON: `JSON_EXTRACT(snapshotJson, '$.totals.closingQty')`. The ledger snapshot is a cache of a JS result, not the source of tồn.
- Money is `DECIMAL`. Compare in the app with the scaled-integer helpers, not raw float.
- Commodity rows live in table `LrtpCommodity` (`@@map`). The Prisma model is `LttpCommodity`.

## Entity disambiguation

**Đơn vị (`Unit`)** is a tree (`parentId`, `path`, `depth`, unique `name`). Kitchen books and LTTP hàng hóa use the storage unit id. A phiếu xuất also has `recipientUnitId` (who receives) which may differ from `unitId` (the warehouse).

**User** is a login (`email`, `username`). Not a headcount. Headcount on the ledger is JSON on the day (`KitchenLedgerDay.headcountJson`), keyed by mức ăn and buổi, not by `User`.

**Mức ăn (`MealAllowanceRate`)** is a public allowance, VND per person per day (`mucTienAn`). `type` is `an_tieu_chuan` or `an_them`. `sortOrder` orders rows inside a type (seeded in steps of 10). A unit opts in through `UnitSelectedMealRate`. `UnitMealPeriodSplit` stores how one standard rate splits across `sang` / `trua` / `chieu` from a `validFrom` date (`periodAmountsJson`, sum equals `mucTienAn`).

**Nhóm LTTP (`LttpFoodGroup`)** is global (superadmin), not per unit. `code` is unique. Commodities point at `groupId`. List and seed order is `sortOrder`, then `name`.

| code | name | sortOrder | where it comes from |
|---|---|---|---|
| `other` | Khác | 0 | migration `20260329_000008_lttp_food_groups` |
| `thuc-pham-kho` | Thực phẩm khô | 10 | dev seed only |
| `rau-cu-qua` | Rau củ quả | 20 | dev seed only |
| `thit-ca` | Thịt cá | 30 | dev seed only |
| `gia-vi` | Gia vị | 40 | dev seed only |

Production may only have `other` until a superadmin adds groups. Do not assume the dev groups exist. Inactive groups stay in the table (`isActive = 0`) and are excluded from pickers.

**Mặt hàng (`LttpCommodity` / `LrtpCommodity`)** is per `unitId`, unique on `(unitId, code)`, required `groupId`, `measureUnit`, optional `conversionRate`.

**Phiếu xuất kho (`LttpIssueSlip` + `LttpIssueSlipLine`)** is one issue document for a storage unit and `issueDate` (DATE). `bookMmyy` is `MMYY` from that date. `slipNo` increases inside `(unitId, bookMmyy)`. Lines snapshot `quantity`, `unitPrice` (mua TT), `tgsxPrice`, `priceKind` (`market` or `tgsx`), and `amount` (quantity times `unitPrice` at save time). The ledger does not trust that snapshot blindly: `assembleLedgerInput` re-prices from the effective `LttpPriceTable` / `LttpPriceRow`.

**Sổ ngày (`KitchenLedgerDay`)** is one row per `(unitId, ledgerDate)`. `status` is `draft` or `locked`. `snapshotJson` is the computed frame. A locked day is not recomputed. `KitchenLedgerLot` is the closing stock carried to the next day, including negative qty. `KitchenLedgerMovement` is what the user typed (self supply, rice, other issues, opening, balance).

## Ledger frame

The on-screen frame is `KitchenLedgerGrid`. Columns A–S match the paper sổ; tồn cuối is on screen only.

| Col | Key | Meaning |
|---|---|---|
| A TT | `tt` | Row number after sort |
| B Tên LTTP | `name` | Item name |
| C ĐVT | `uom` | Unit of measure (`đ` when `displayDash`) |
| D Đơn giá | `unitPrice` | Price of this lot |
| E–F | `openingQty`, `openingAmount` | Brought forward |
| G–J | `inG` `inH` `inI` `inJ` | Trên BĐ mua TT, Trên BĐ TGSX, Đơn vị BĐ mua TT, Đơn vị BĐ TGSX |
| K | `inAmount` | (G+H+I+J) × D |
| L–M | `totalInQty`, `totalInAmount` | Opening plus receipts |
| N–O | `mealQty`, `mealAmount` | Issued for meals |
| P–Q | `otherQty`, `otherAmount` | Other issues |
| R–S | `totalOutQty`, `totalOutAmount` | Meal plus other |
| on screen | `closingQty`, `closingAmount` | Tồn cuối |

Sort before numbering: gạo, then fresh, then gia vị, then chất đốt (`roleRank`), then first-seen item, then `receivedDate`, then price. A page break marker is a display split (`splitLedgerPages`: one page up to 28 lines, then pages of 40 with a tail of at least 2).

## How tồn is computed

Tồn is **not** a stored SQL aggregate. `computeLedger` in `kitchen-ledger-compute.js` builds it. `kitchen-ledger-assemble.js` prepares the input: phiếu xuất lines become cột G (mua TT) or H (TGSX); gạo on a phiếu is skipped when rice is manual; user movements become cột I, J, or G for rice. Missing phiếu xuất or bảng giá blocks the frame (`ledgerBlocked`) but the day shell still opens.

Per lot (same normalized name and unit price):

- `inTotal = inG + inH + inI + inJ`
- `totalInQty = openingQty + inTotal`
- Meal qty:
  - Fresh goods follow the issue policy. `today` issues purchases except cân đối receipts. `all` also issues the opening. `keep` issues nothing.
  - Gạo, gia vị, sữa (when not purchase-mode), and chất đốt are allocated FIFO by `receivedDate` then price. Leftover need is piled on the last lot and may go negative.
- Other issues allocate FIFO the same way.
- `totalOutQty = mealQty + otherQty`
- **`closingQty = totalInQty - totalOutQty`**
- `closingAmount = closingQty * unitPrice`
- Fuel is stored at price 1 with dashes in the qty columns.

Negative tồn is kept on purpose so a shortage is not dropped. Cân đối does not run until someone presses the button. Closing lots with non-zero qty become the next day's opening (`KitchenLedgerLot`).

Amounts use the scaled integer helpers in `kitchen-ledger-decimal.js` (half-up). Do not reimplement tồn as `SUM(quantity)` over phiếu lines.

## Standard filters

```sql
-- Active food groups in display order
SELECT `code`, `name`, `sortOrder`
FROM `LttpFoodGroup`
WHERE `isActive` = 1
ORDER BY `sortOrder`, `name`;

-- Phiếu xuất lines for one warehouse day
SELECT s.`id`, s.`slipNo`, s.`bookMmyy`, c.`name`, l.`quantity`, l.`unitPrice`, l.`priceKind`
FROM `LttpIssueSlip` s
JOIN `LttpIssueSlipLine` l ON l.`slipId` = s.`id`
JOIN `LrtpCommodity` c ON c.`id` = l.`commodityId`
WHERE s.`unitId` = ?
  AND s.`issueDate` = ?
ORDER BY s.`slipNo`, l.`id`;
```

Skip `deletedAt IS NOT NULL` users. Ledger queries should pass `unitId` of the storage unit, not a child recipient, unless the question is about `recipientUnitId`.

## What not to do

Do not point a database MCP at this MariaDB from the project MCP config. Do not treat dev-seed groups or the sample unit as production master data. Do not compute tồn in SQL when the task is to change the sổ; change `computeLedger` and its test in `kitchen-ledger-compute.test.js`.
