-- Phiếu nhập kho bếp ăn
CREATE TABLE `KitchenReceiptSlip` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `receiptDate` DATE NOT NULL,
    `note` VARCHAR(500) NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `bookMmyy` CHAR(4) NOT NULL,
    `slipNo` INTEGER NOT NULL,

    INDEX `KitchenReceiptSlip_unitId_receiptDate_idx`(`unitId`, `receiptDate`),
    INDEX `KitchenReceiptSlip_unitId_bookMmyy_slipNo_idx`(`unitId`, `bookMmyy`, `slipNo`),
    INDEX `KitchenReceiptSlip_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `KitchenReceiptSlipSerial` (
    `unitId` INTEGER NOT NULL,
    `bookMmyy` CHAR(4) NOT NULL,
    `lastSlipNo` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`unitId`, `bookMmyy`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `KitchenReceiptSlipLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slipId` INTEGER NOT NULL,
    `commodityId` INTEGER NOT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `unitPrice` DECIMAL(18, 2) NOT NULL,
    `tgsxPrice` DECIMAL(18, 2) NULL,
    `priceKind` ENUM('market', 'tgsx') NOT NULL DEFAULT 'market',
    `amount` DECIMAL(18, 2) NOT NULL,
    `lineNote` VARCHAR(500) NULL,

    INDEX `KitchenReceiptSlipLine_slipId_idx`(`slipId`),
    INDEX `KitchenReceiptSlipLine_commodityId_idx`(`commodityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `KitchenReceiptSlip` ADD CONSTRAINT `KitchenReceiptSlip_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `KitchenReceiptSlip` ADD CONSTRAINT `KitchenReceiptSlip_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `KitchenReceiptSlipSerial` ADD CONSTRAINT `KitchenReceiptSlipSerial_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `KitchenReceiptSlipLine` ADD CONSTRAINT `KitchenReceiptSlipLine_slipId_fkey` FOREIGN KEY (`slipId`) REFERENCES `KitchenReceiptSlip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `KitchenReceiptSlipLine` ADD CONSTRAINT `KitchenReceiptSlipLine_commodityId_fkey` FOREIGN KEY (`commodityId`) REFERENCES `LrtpCommodity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
