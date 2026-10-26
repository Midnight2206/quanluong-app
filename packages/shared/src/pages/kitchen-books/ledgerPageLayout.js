/** Khung trang sổ: trang trái rồi trang phải, một bảng. Sửa mảng này khi ảnh mẫu đổi. */

export const LEDGER_PIN_WIDTHS = [44, 168];

export const LEDGER_BODY_COLUMNS = [
  { key: "tt", align: "center", width: 44, pin: 0 },
  { key: "name", align: "left", width: 168, pin: 1 },
  { key: "uom", align: "center", width: 52 },
  { key: "unitPrice", align: "right", width: 72, money: true },
  { key: "openingQty", align: "right", width: 64, qty: true, dashWith: "openingAmount" },
  { key: "openingAmount", align: "right", width: 84, money: true, total: true },
  { key: "inG", align: "right", width: 58, qty: true },
  { key: "inH", align: "right", width: 58, qty: true },
  { key: "inI", align: "right", width: 58, qty: true, dashWith: "inAmount" },
  { key: "inJ", align: "right", width: 58, qty: true },
  { key: "inAmount", align: "right", width: 84, money: true, total: true },
  { key: "totalInQty", align: "right", width: 64, qty: true, dashWith: "totalInAmount" },
  { key: "totalInAmount", align: "right", width: 84, money: true, total: true },
  { key: "mealQty", align: "right", width: 64, qty: true, dashWith: "mealAmount" },
  { key: "mealAmount", align: "right", width: 84, money: true, total: true },
  { key: "otherQty", align: "right", width: 58, qty: true },
  { key: "otherAmount", align: "right", width: 80, money: true, total: true },
  { key: "totalOutQty", align: "right", width: 64, qty: true, dashWith: "totalOutAmount" },
  { key: "totalOutAmount", align: "right", width: 84, money: true, total: true },
  { key: "cktc", align: "left", width: 280 },
];

function cell(id, label, extra = {}) {
  return { id, label, ...extra };
}

export function ledgerHeaderRows(dateLine) {
  return [
    [
      cell("tt", "TT", { rowSpan: 4 }),
      cell("name", "Tên LTTP-Chất đốt", { rowSpan: 4 }),
      cell("uom", "ĐVT", { rowSpan: 4 }),
      cell("price", "Đơn giá", { rowSpan: 4 }),
      cell("carry", "Ngày trước chuyển qua", { colSpan: 2 }),
      cell("in", "Nhập trong ngày", { colSpan: 5 }),
      cell("total-in", "Cộng nhập", { colSpan: 2 }),
      cell("meal", "Xuất ăn trong ngày", { colSpan: 2 }),
      cell("other", "Xuất khác", { colSpan: 2 }),
      cell("total-out", "Cộng xuất", { colSpan: 2 }),
      cell("cktc", "CÔNG KHAI TÀI CHÍNH", { rowSpan: 4, dateLine: dateLine || "" }),
    ],
    [
      cell("carry-qty", "Số lượng", { rowSpan: 3 }),
      cell("carry-money", "Thành tiền", { rowSpan: 3 }),
      cell("in-qty", "Số lượng", { colSpan: 4 }),
      cell("in-money", "Thành tiền", { rowSpan: 3 }),
      cell("tin-qty", "Số lượng", { rowSpan: 3 }),
      cell("tin-money", "Thành tiền", { rowSpan: 3 }),
      cell("meal-qty", "Số lượng", { rowSpan: 3 }),
      cell("meal-money", "Thành tiền", { rowSpan: 3 }),
      cell("other-qty", "Số lượng", { rowSpan: 3 }),
      cell("other-money", "Thành tiền", { rowSpan: 3 }),
      cell("tout-qty", "Số lượng", { rowSpan: 3 }),
      cell("tout-money", "Thành tiền", { rowSpan: 3 }),
    ],
    [
      cell("tren-bd", "Trên BĐ", { colSpan: 2 }),
      cell("don-vi-bd", "Đơn vị BĐ", { colSpan: 2 }),
    ],
    [
      cell("g", "Mua TT"),
      cell("h", "TG CB"),
      cell("i", "Mua TT"),
      cell("j", "TG CB"),
    ],
  ];
}

/** @returns {string[][]} ô đã chiếm, ném nếu đè hoặc thủng */
export function headerCoverage(rows, width = LEDGER_BODY_COLUMNS.length) {
  const height = rows.length;
  const grid = Array.from({ length: height }, () => Array(width).fill(""));
  rows.forEach((row, r) => {
    let c = 0;
    for (const item of row) {
      while (c < width && grid[r][c]) c += 1;
      const rs = item.rowSpan || 1;
      const cs = item.colSpan || 1;
      for (let rr = 0; rr < rs; rr += 1) {
        for (let cc = 0; cc < cs; cc += 1) {
          if (!grid[r + rr] || grid[r + rr][c + cc] == null || grid[r + rr][c + cc]) {
            throw new Error(`Ô chồng hoặc tràn: ${item.id}`);
          }
          grid[r + rr][c + cc] = item.id;
        }
      }
      c += cs;
    }
  });
  if (grid.some((row) => row.some((id) => !id))) throw new Error("Header còn ô trống");
  return grid;
}
