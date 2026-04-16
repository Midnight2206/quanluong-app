-- CreateTable
CREATE TABLE `LrtpCommodity` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `measureUnit` VARCHAR(64) NOT NULL,
    `foodGroup` VARCHAR(191) NULL,
    `conversionRate` DECIMAL(18, 8) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LrtpCommodity_unitId_code_key`(`unitId`, `code`),
    INDEX `LrtpCommodity_unitId_idx`(`unitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LrtpPriceTable` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `effectiveDate` DATE NOT NULL,
    `note` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LrtpPriceTable_unitId_effectiveDate_key`(`unitId`, `effectiveDate`),
    INDEX `LrtpPriceTable_unitId_effectiveDate_idx`(`unitId`, `effectiveDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LrtpPriceRow` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `priceTableId` INTEGER NOT NULL,
    `commodityId` INTEGER NOT NULL,
    `unitPrice` DECIMAL(18, 2) NOT NULL,
    `tgsxPrice` DECIMAL(18, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LrtpPriceRow_priceTableId_commodityId_key`(`priceTableId`, `commodityId`),
    INDEX `LrtpPriceRow_commodityId_idx`(`commodityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LrtpCommodity` ADD CONSTRAINT `LrtpCommodity_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LrtpPriceTable` ADD CONSTRAINT `LrtpPriceTable_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LrtpPriceRow` ADD CONSTRAINT `LrtpPriceRow_priceTableId_fkey` FOREIGN KEY (`priceTableId`) REFERENCES `LrtpPriceTable`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LrtpPriceRow` ADD CONSTRAINT `LrtpPriceRow_commodityId_fkey` FOREIGN KEY (`commodityId`) REFERENCES `LrtpCommodity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
