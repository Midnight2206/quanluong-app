-- Bảng giá đối tác tách bảng giá LTTP công khai
CREATE TABLE `LttpPartnerPriceTable` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `effectiveDate` DATE NOT NULL,
    `note` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `LttpPartnerPriceTable_unitId_effectiveDate_idx`(`unitId`, `effectiveDate`),
    UNIQUE INDEX `LttpPartnerPriceTable_unitId_effectiveDate_key`(`unitId`, `effectiveDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LttpPartnerPriceRow` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `priceTableId` INTEGER NOT NULL,
    `commodityId` INTEGER NOT NULL,
    `partnerUnitPrice` DECIMAL(18, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `LttpPartnerPriceRow_commodityId_idx`(`commodityId`),
    UNIQUE INDEX `LttpPartnerPriceRow_priceTableId_commodityId_key`(`priceTableId`, `commodityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LttpPartnerPriceTable` ADD CONSTRAINT `LttpPartnerPriceTable_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `LttpPartnerPriceRow` ADD CONSTRAINT `LttpPartnerPriceRow_priceTableId_fkey` FOREIGN KEY (`priceTableId`) REFERENCES `LttpPartnerPriceTable`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `LttpPartnerPriceRow` ADD CONSTRAINT `LttpPartnerPriceRow_commodityId_fkey` FOREIGN KEY (`commodityId`) REFERENCES `LrtpCommodity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
