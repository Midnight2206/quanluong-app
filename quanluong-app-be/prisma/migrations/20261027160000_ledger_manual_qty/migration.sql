-- Nhập tay theo số lượng. Cột mới đều để trống, không điền nguồn/phẩm cấp cho hàng cũ.

ALTER TABLE `LrtpCommodity`
  ADD COLUMN `sourceKind` VARCHAR(16) NULL,
  ADD COLUMN `grade` VARCHAR(16) NULL;

ALTER TABLE `KitchenLedgerDay`
  ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `pdfFingerprint` VARCHAR(64) NULL;

ALTER TABLE `KitchenLedgerMovement`
  ADD COLUMN `sourceKind` VARCHAR(16) NULL,
  ADD COLUMN `grade` VARCHAR(16) NULL,
  ADD COLUMN `manualTemporary` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `KitchenLedgerChange` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `dayId` INTEGER NOT NULL,
  `userId` INTEGER NULL,
  `action` VARCHAR(32) NOT NULL,
  `source` VARCHAR(16) NOT NULL,
  `reason` VARCHAR(500) NULL,
  `beforeJson` JSON NULL,
  `afterJson` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `KitchenLedgerChange_dayId_idx`(`dayId`),
  INDEX `KitchenLedgerChange_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `KitchenLedgerChange` ADD CONSTRAINT `KitchenLedgerChange_dayId_fkey` FOREIGN KEY (`dayId`) REFERENCES `KitchenLedgerDay`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `KitchenLedgerChange` ADD CONSTRAINT `KitchenLedgerChange_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
