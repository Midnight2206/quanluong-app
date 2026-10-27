/**
 * Khung in sổ. Bản sao của packages/shared/.../ledgerPageLayout.js (LEDGER_PRINT_LAYOUT).
 * Image backend không import packages/shared. Test so hai bản.
 */
const LEDGER_PRINT_LAYOUT = {
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

export { LEDGER_PRINT_LAYOUT };
