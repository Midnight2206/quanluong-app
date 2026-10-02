-- Người mua theo kho, hiệu lực từ một ngày. Phiếu cũ giữ người mua của mốc trước.

CREATE TABLE `LttpWarehouseBuyerTerm` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `unitId` INTEGER NOT NULL,
  `effectiveDate` DATE NOT NULL,
  `buyerUserId` INTEGER NOT NULL,
  `createdById` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `LttpWarehouseBuyerTerm_unitId_effectiveDate_key`(`unitId`, `effectiveDate`),
  INDEX `LttpWarehouseBuyerTerm_buyerUserId_idx`(`buyerUserId`),
  INDEX `LttpWarehouseBuyerTerm_createdById_idx`(`createdById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LttpWarehouseBuyerTerm`
  ADD CONSTRAINT `LttpWarehouseBuyerTerm_unitId_fkey`
    FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `LttpWarehouseBuyerTerm_buyerUserId_fkey`
    FOREIGN KEY (`buyerUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `LttpWarehouseBuyerTerm_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
