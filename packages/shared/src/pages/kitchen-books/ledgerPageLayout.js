/** Khung trang sổ: trang trái rồi trang phải, một bảng. Sửa mảng này khi ảnh mẫu đổi. */

export const LEDGER_PIN_WIDTHS = [25, 159];

export const LEDGER_BODY_COLUMNS = [
  { key: "tt", align: "center", width: 25, pin: 0 },
  { key: "name", align: "left", width: 159, pin: 1 },
  { key: "uom", align: "center", width: 26 },
  { key: "unitPrice", align: "right", width: 43, money: true },
  { key: "openingQty", align: "center", width: 32, qty: true, dashWith: "openingAmount" },
  { key: "openingAmount", align: "right", width: 59, money: true, total: true },
  { key: "inG", align: "center", width: 35, qty: true },
  { key: "inH", align: "center", width: 35, qty: true },
  { key: "inI", align: "center", width: 33, qty: true, dashWith: "inAmount" },
  { key: "inJ", align: "center", width: 33, qty: true },
  { key: "inAmount", align: "right", width: 53, money: true, total: true },
  { key: "totalInQty", align: "center", width: 33, qty: true, dashWith: "totalInAmount" },
  { key: "totalInAmount", align: "right", width: 52, money: true, total: true },
  { key: "mealQty", align: "center", width: 34, qty: true, dashWith: "mealAmount" },
  { key: "mealAmount", align: "right", width: 53, money: true, total: true },
  { key: "otherQty", align: "center", width: 32, qty: true },
  { key: "otherAmount", align: "right", width: 33, money: true, total: true },
  { key: "totalOutQty", align: "center", width: 32, qty: true, dashWith: "totalOutAmount" },
  { key: "totalOutAmount", align: "right", width: 52, money: true, total: true },
  { key: "cktc", align: "left", width: 209 },
];

function cell(id, label, extra = {}) {
  return { id, label, ...extra };
}

export function ledgerHeaderRows(dateLine) {
  return [
    [
      cell("tt", "TT", { rowSpan: 5 }),
      cell("name", "Tên LTTP-Chất đốt", { rowSpan: 5 }),
      cell("uom", "ĐVT", { rowSpan: 5 }),
      cell("price", "Đơn giá", { rowSpan: 5 }),
      cell("carry", "Ngày trước\nchuyển qua", { colSpan: 2 }),
      cell("in", "Nhập trong ngày", { colSpan: 5 }),
      cell("total-in", "Cộng nhập", { colSpan: 2 }),
      cell("meal", "Xuất ăn\ntrong ngày", { colSpan: 2 }),
      cell("other", "Xuất khác", { colSpan: 2 }),
      cell("total-out", "Cộng xuất", { colSpan: 2 }),
      cell("cktc", "CÔNG KHAI TÀI CHÍNH", { rowSpan: 5, dateLine: dateLine || "" }),
    ],
    [
      cell("carry-qty", "Số\nlượng", { rowSpan: 4 }),
      cell("carry-money", "Thành tiền", { rowSpan: 4 }),
      cell("in-qty", "Số lượng", { colSpan: 4 }),
      cell("in-money", "Thành\ntiền", { rowSpan: 4 }),
      cell("tin-qty", "Số\nlượng", { rowSpan: 4 }),
      cell("tin-money", "Thành tiền", { rowSpan: 4 }),
      cell("meal-qty", "Số\nlượng", { rowSpan: 4 }),
      cell("meal-money", "Thành tiền", { rowSpan: 4 }),
      cell("other-qty", "Số\nlượng", { rowSpan: 4 }),
      cell("other-money", "Thành\ntiền", { rowSpan: 4 }),
      cell("tout-qty", "Số\nlượng", { rowSpan: 4 }),
      cell("tout-money", "Thành tiền", { rowSpan: 4 }),
    ],
    [
      cell("tren-bd", "Trên BĐ", { colSpan: 2 }),
      cell("don-vi-bd", "Đơn vị BĐ", { colSpan: 2 }),
    ],
    [
      cell("g", "Mua\nTT", { rowSpan: 2 }),
      cell("h-tg", "TG"),
      cell("i", "Mua\nTT", { rowSpan: 2 }),
      cell("j-tg", "TG"),
    ],
    [
      cell("h-cb", "CB"),
      cell("j-cb", "CB"),
    ],
  ];
}

/** Cùng kitchen-ledger-layout.js phía backend. Số đo pt đã gồm tỉ lệ in 97 %. */
export const LEDGER_PRINT_LAYOUT = {
  scale: 0.97,
  rowHeight: 14.55,
  headerRowCount: 5,
  headerHeights: [31.2, 14.55, 14.55, 14.55, 14.55],
  firstTableTop: 57.7,
  nextTableTop: 43.1,
  printBottom: 798.7,
  signatureBlock: 95.2,
  minFirstRows: 28,
  minTail: 2,
  leftWidths: [24.5, 159.3, 26.3, 42.5, 31.6, 58.6, 35.3, 35.3, 32.8, 32.9, 53.2],
  rightWidths: [32.8, 52.0, 33.5, 53.2, 31.6, 32.9, 31.6, 52.1, 95.0, 114.3],
  dateCell: [8, 1, 2, 1],
  leftHeader: [
    [0, 0, 1, 5, "TT"],
    [1, 0, 1, 5, "Tên LTTP-Chất đốt"],
    [2, 0, 1, 5, "ĐVT"],
    [3, 0, 1, 5, "Đơn giá"],
    [4, 0, 2, 1, "Ngày trước\nchuyển qua"],
    [6, 0, 5, 1, "Nhập trong ngày"],
    [4, 1, 1, 4, "Số\nlượng"],
    [5, 1, 1, 4, "Thành tiền"],
    [6, 1, 4, 1, "Số lượng"],
    [10, 1, 1, 4, "Thành\ntiền"],
    [6, 2, 2, 1, "Trên BĐ"],
    [8, 2, 2, 1, "Đơn vị BĐ"],
    [6, 3, 1, 2, "Mua\nTT"],
    [7, 3, 1, 1, "TG"],
    [8, 3, 1, 2, "Mua\nTT"],
    [9, 3, 1, 1, "TG"],
    [7, 4, 1, 1, "CB"],
    [9, 4, 1, 1, "CB"],
  ],
  rightHeader: [
    [0, 0, 2, 1, "Cộng nhập"],
    [2, 0, 2, 1, "Xuất ăn\ntrong ngày"],
    [4, 0, 2, 1, "Xuất khác"],
    [6, 0, 2, 1, "Cộng xuất"],
    [8, 0, 2, 1, "CÔNG KHAI TÀI CHÍNH"],
    [0, 1, 1, 4, "Số\nlượng"],
    [1, 1, 1, 4, "Thành tiền"],
    [2, 1, 1, 4, "Số\nlượng"],
    [3, 1, 1, 4, "Thành tiền"],
    [4, 1, 1, 4, "Số\nlượng"],
    [5, 1, 1, 4, "Thành\ntiền"],
    [6, 1, 1, 4, "Số\nlượng"],
    [7, 1, 1, 4, "Thành tiền"],
    [8, 2, 2, 3, ""],
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
