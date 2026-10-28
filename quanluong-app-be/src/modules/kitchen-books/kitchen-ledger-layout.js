/**
 * Khung in sổ. Bản sao của packages/shared/.../ledgerPageLayout.js (LEDGER_PRINT_LAYOUT).
 * Image backend không import packages/shared. Test so hai bản.
 * Số đo pt đã gồm tỉ lệ in 97 %.
 */
const LEDGER_PRINT_LAYOUT = {
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

export { LEDGER_PRINT_LAYOUT };
