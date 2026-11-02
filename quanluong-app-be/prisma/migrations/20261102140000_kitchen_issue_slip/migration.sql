-- Phiếu xuất kho của bếp (sáng/trưa/chiều) và họ tên in trên phiếu nhập.
-- Không thêm cột thu, chi, thừa, thiếu. Cân đối thu chi chỉ đọc công khai tài chính trên app.

ALTER TABLE `KitchenReceiptSlip`
  ADD COLUMN `supplierName` VARCHAR(191) NULL,
  ADD COLUMN `signerLap` VARCHAR(191) NULL,
  ADD COLUMN `signerGiao` VARCHAR(191) NULL,
  ADD COLUMN `signerNhan` VARCHAR(191) NULL,
  ADD COLUMN `signerDuyet` VARCHAR(191) NULL;

CREATE TABLE `KitchenIssueSlip` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `unitId` INTEGER NOT NULL,
  `issueDate` DATE NOT NULL,
  `note` VARCHAR(500) NULL,
  `recipientName` VARCHAR(191) NULL,
  `departmentName` VARCHAR(191) NULL,
  `reason` VARCHAR(255) NULL,
  `receivePlace` VARCHAR(191) NULL,
  `signerWriter` VARCHAR(191) NULL,
  `signerRecipient` VARCHAR(191) NULL,
  `signerStorekeeper` VARCHAR(191) NULL,
  `signerApprover` VARCHAR(191) NULL,
  `createdById` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `bookMmyy` CHAR(4) NOT NULL,
  `slipNo` INTEGER NOT NULL,

  UNIQUE INDEX `KitchenIssueSlip_unitId_issueDate_key`(`unitId`, `issueDate`),
  INDEX `KitchenIssueSlip_createdById_idx`(`createdById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `KitchenIssueSlipLine` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `slipId` INTEGER NOT NULL,
  `commodityId` INTEGER NOT NULL,
  `sang` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `trua` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `chieu` DECIMAL(18, 4) NOT NULL DEFAULT 0,
  `unitPrice` DECIMAL(18, 2) NOT NULL,
  `lineNote` VARCHAR(500) NULL,

  INDEX `KitchenIssueSlipLine_slipId_idx`(`slipId`),
  INDEX `KitchenIssueSlipLine_commodityId_idx`(`commodityId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `KitchenIssueSlip` ADD CONSTRAINT `KitchenIssueSlip_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `KitchenIssueSlip` ADD CONSTRAINT `KitchenIssueSlip_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `KitchenIssueSlipLine` ADD CONSTRAINT `KitchenIssueSlipLine_slipId_fkey` FOREIGN KEY (`slipId`) REFERENCES `KitchenIssueSlip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `KitchenIssueSlipLine` ADD CONSTRAINT `KitchenIssueSlipLine_commodityId_fkey` FOREIGN KEY (`commodityId`) REFERENCES `LrtpCommodity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
