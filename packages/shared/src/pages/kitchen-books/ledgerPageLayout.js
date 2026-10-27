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

/** Cùng kitchen-ledger-layout.js phía backend. PDF đọc payload này. */
export const LEDGER_PRINT_LAYOUT = {
  fontData: 7,
  fontHead: 6.5,
  scale: 0.97,
  headerRowCount: 4,
  singlePageMax: 28,
  pageCapacity: 40,
  minTail: 2,
  dateCell: [8, 1, 2, 1],
  leftHeader: [
    [0, 0, 1, 4, "TT"],
    [1, 0, 1, 4, "Tên LTTP-Chất đốt"],
    [2, 0, 1, 4, "ĐVT"],
    [3, 0, 1, 4, "Đơn giá"],
    [4, 0, 2, 1, "Ngày trước chuyển qua"],
    [6, 0, 5, 1, "Nhập trong ngày"],
    [4, 1, 1, 3, "Số lượng"],
    [5, 1, 1, 3, "Thành tiền"],
    [6, 1, 4, 1, "Số lượng"],
    [10, 1, 1, 3, "Thành tiền"],
    [6, 2, 2, 1, "Trên BĐ"],
    [8, 2, 2, 1, "Đơn vị BĐ"],
    [6, 3, 1, 1, "Mua TT"],
    [7, 3, 1, 1, "TG CB"],
    [8, 3, 1, 1, "Mua TT"],
    [9, 3, 1, 1, "TG CB"],
  ],
  rightHeader: [
    [0, 0, 2, 1, "Cộng nhập"],
    [2, 0, 2, 1, "Xuất ăn trong ngày"],
    [4, 0, 2, 1, "Xuất khác"],
    [6, 0, 2, 1, "Cộng xuất"],
    [8, 0, 2, 1, "CÔNG KHAI TÀI CHÍNH"],
    [0, 1, 1, 3, "Số lượng"],
    [1, 1, 1, 3, "Thành tiền"],
    [2, 1, 1, 3, "Số lượng"],
    [3, 1, 1, 3, "Thành tiền"],
    [4, 1, 1, 3, "Số lượng"],
    [5, 1, 1, 3, "Thành tiền"],
    [6, 1, 1, 3, "Số lượng"],
    [7, 1, 1, 3, "Thành tiền"],
  ],
};

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
