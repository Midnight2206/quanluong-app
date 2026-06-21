-- Snapshot BKMH mỗi lần tạo/đồng bộ — phục vụ phiếu nhập kho sau này.
CREATE TABLE `ChungTuBkmhSnapshot` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `documentId` INTEGER NOT NULL,
  `eventType` VARCHAR(16) NOT NULL,
  `syncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `periodMonth` VARCHAR(7) NOT NULL,
  `periodDate` VARCHAR(10) NOT NULL,
  `sheetName` VARCHAR(31) NULL,
  `soChungTu` VARCHAR(64) NULL,
  `quyenSo` VARCHAR(32) NULL,
  `ngay` VARCHAR(2) NULL,
  `thang` VARCHAR(2) NULL,
  `nam` VARCHAR(4) NULL,
  `tongTien` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `nguoiMua` VARCHAR(191) NULL,
  `aggregationMode` VARCHAR(16) NULL,
  `sourceDataHash` VARCHAR(64) NULL,
  PRIMARY KEY (`id`),
  INDEX `ChungTuBkmhSnapshot_documentId_syncedAt_idx` (`documentId`, `syncedAt`),
  INDEX `ChungTuBkmhSnapshot_periodMonth_periodDate_idx` (`periodMonth`, `periodDate`),
  CONSTRAINT `ChungTuBkmhSnapshot_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `ChungTuDocument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
