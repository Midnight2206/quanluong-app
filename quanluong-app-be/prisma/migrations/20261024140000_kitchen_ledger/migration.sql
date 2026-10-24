-- Sổ nhập xuất LTTP: cấu hình theo đơn vị, ngày sổ, tồn cuối, dòng nhập của người dùng.
CREATE TABLE `KitchenLedgerSettings` (
    `unitId` INTEGER NOT NULL,
    `configJson` JSON NOT NULL,
    `updatedById` INTEGER NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KitchenLedgerSettings_updatedById_idx`(`updatedById`),
    PRIMARY KEY (`unitId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `KitchenLedgerDay` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `ledgerDate` DATE NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'draft',
    `lockedAt` DATETIME(3) NULL,
    `lockedById` INTEGER NULL,
    `needsResignature` BOOLEAN NOT NULL DEFAULT false,
    `slipFingerprint` VARCHAR(64) NULL,
    `selfSupplyNone` BOOLEAN NOT NULL DEFAULT false,
    `headcountJson` JSON NULL,
    `otherIncomeJson` JSON NULL,
    `openingFinanceJson` JSON NULL,
    `snapshotJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `KitchenLedgerDay_unitId_ledgerDate_key`(`unitId`, `ledgerDate`),
    INDEX `KitchenLedgerDay_lockedById_idx`(`lockedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `KitchenLedgerLot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dayId` INTEGER NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `commodityId` INTEGER NULL,
    `itemName` VARCHAR(255) NOT NULL,
    `measureUnit` VARCHAR(64) NOT NULL,
    `unitPrice` DECIMAL(18, 4) NOT NULL,
    `receivedDate` DATE NOT NULL,
    `qty` DECIMAL(18, 4) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `role` VARCHAR(16) NOT NULL,
    `displayDash` BOOLEAN NOT NULL DEFAULT false,

    INDEX `KitchenLedgerLot_dayId_idx`(`dayId`),
    INDEX `KitchenLedgerLot_commodityId_idx`(`commodityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `KitchenLedgerMovement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dayId` INTEGER NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `kind` VARCHAR(32) NOT NULL,
    `source` VARCHAR(8) NOT NULL,
    `commodityId` INTEGER NULL,
    `itemName` VARCHAR(255) NOT NULL,
    `measureUnit` VARCHAR(64) NOT NULL,
    `unitPrice` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `qty` DECIMAL(18, 4) NOT NULL,
    `issuePolicy` VARCHAR(16) NOT NULL DEFAULT 'today',

    INDEX `KitchenLedgerMovement_dayId_kind_idx`(`dayId`, `kind`),
    INDEX `KitchenLedgerMovement_commodityId_idx`(`commodityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `KitchenLedgerSettings` ADD CONSTRAINT `KitchenLedgerSettings_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `KitchenLedgerSettings` ADD CONSTRAINT `KitchenLedgerSettings_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `KitchenLedgerDay` ADD CONSTRAINT `KitchenLedgerDay_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `KitchenLedgerDay` ADD CONSTRAINT `KitchenLedgerDay_lockedById_fkey` FOREIGN KEY (`lockedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `KitchenLedgerLot` ADD CONSTRAINT `KitchenLedgerLot_dayId_fkey` FOREIGN KEY (`dayId`) REFERENCES `KitchenLedgerDay`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `KitchenLedgerLot` ADD CONSTRAINT `KitchenLedgerLot_commodityId_fkey` FOREIGN KEY (`commodityId`) REFERENCES `LrtpCommodity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `KitchenLedgerMovement` ADD CONSTRAINT `KitchenLedgerMovement_dayId_fkey` FOREIGN KEY (`dayId`) REFERENCES `KitchenLedgerDay`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `KitchenLedgerMovement` ADD CONSTRAINT `KitchenLedgerMovement_commodityId_fkey` FOREIGN KEY (`commodityId`) REFERENCES `LrtpCommodity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
