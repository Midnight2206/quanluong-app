-- Bổ sung phiếu xuất: đơn vị / user nhận, quyển MMYY, số phiếu, mẫu in; bảng serial & mẫu mặc định.

-- Bước 1: cột tùy chọn
ALTER TABLE `LttpIssueSlip` ADD COLUMN `recipientUnitId` INTEGER NULL;
ALTER TABLE `LttpIssueSlip` ADD COLUMN `recipientUserId` INTEGER NULL;
ALTER TABLE `LttpIssueSlip` ADD COLUMN `recipientDisplayName` VARCHAR(191) NULL;
ALTER TABLE `LttpIssueSlip` ADD COLUMN `printLine1` VARCHAR(255) NULL;
ALTER TABLE `LttpIssueSlip` ADD COLUMN `printLine2` VARCHAR(128) NULL;
ALTER TABLE `LttpIssueSlip` ADD COLUMN `formMauSo` VARCHAR(64) NULL;
ALTER TABLE `LttpIssueSlip` ADD COLUMN `warehouseFrom` VARCHAR(128) NULL;
ALTER TABLE `LttpIssueSlip` ADD COLUMN `signerWriter` VARCHAR(191) NULL;
ALTER TABLE `LttpIssueSlip` ADD COLUMN `signerRecipient` VARCHAR(191) NULL;
ALTER TABLE `LttpIssueSlip` ADD COLUMN `signerApprover` VARCHAR(191) NULL;
ALTER TABLE `LttpIssueSlip` ADD COLUMN `bookMmyy` CHAR(4) NULL;
ALTER TABLE `LttpIssueSlip` ADD COLUMN `slipNo` INTEGER NULL;

-- Backfill bookMmyy, slipNo theo dữ liệu cũ
UPDATE `LttpIssueSlip`
SET `bookMmyy` = CONCAT(
  LPAD(MONTH(`issueDate`), 2, '0'),
  LPAD((YEAR(`issueDate`) % 100), 2, '0')
)
WHERE `bookMmyy` IS NULL;

-- Số cũ: gán ổn định theo id; sau này chỉ tăng theo bảng serial
UPDATE `LttpIssueSlip` SET `slipNo` = `id` WHERE `slipNo` IS NULL;

ALTER TABLE `LttpIssueSlip` MODIFY COLUMN `bookMmyy` CHAR(4) NOT NULL;
ALTER TABLE `LttpIssueSlip` MODIFY COLUMN `slipNo` INTEGER NOT NULL;

CREATE TABLE `LttpIssueSlipSerial` (
  `unitId` INTEGER NOT NULL,
  `bookMmyy` CHAR(4) NOT NULL,
  `lastSlipNo` INTEGER NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`unitId`, `bookMmyy`),
  CONSTRAINT `LttpIssueSlipSerial_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4;

INSERT INTO `LttpIssueSlipSerial` (`unitId`, `bookMmyy`, `lastSlipNo`, `updatedAt`)
SELECT `unitId`, `bookMmyy`, MAX(`slipNo`), NOW(3) FROM `LttpIssueSlip` GROUP BY `unitId`, `bookMmyy`;

CREATE TABLE `LttpUnitIssueFormDefaults` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `unitId` INTEGER NOT NULL,
  `printLine1` VARCHAR(255) NULL,
  `printLine2` VARCHAR(128) NULL,
  `formMauSo` VARCHAR(64) NULL,
  `warehouseFrom` VARCHAR(128) NULL,
  `signerWriter` VARCHAR(191) NULL,
  `signerApprover` VARCHAR(191) NULL,
  `defaultRecipientUnitId` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `LttpUnitIssueFormDefaults_unitId_key`(`unitId`),
  INDEX `LttpUnitIssueFormDefaults_defaultRecipientUnitId_idx`(`defaultRecipientUnitId`),
  CONSTRAINT `LttpUnitIssueFormDefaults_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `LttpUnitIssueFormDefaults_defaultRecipientUnitId_fkey` FOREIGN KEY (`defaultRecipientUnitId`) REFERENCES `Unit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4;

CREATE INDEX `LttpIssueSlip_recipientUnitId_idx` ON `LttpIssueSlip`(`recipientUnitId`);

ALTER TABLE `LttpIssueSlip`
  ADD CONSTRAINT `LttpIssueSlip_recipientUnitId_fkey` FOREIGN KEY (`recipientUnitId`) REFERENCES `Unit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `LttpIssueSlip_recipientUserId_fkey` FOREIGN KEY (`recipientUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
