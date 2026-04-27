CREATE TABLE `LttpPartnerDebt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `lttpSupplierId` INTEGER NOT NULL,
    `totalDebtAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `lastRecalculatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `LttpPartnerDebt_unitId_idx`(`unitId`),
    INDEX `LttpPartnerDebt_lttpSupplierId_idx`(`lttpSupplierId`),
    UNIQUE INDEX `LttpPartnerDebt_unitId_lttpSupplierId_key`(`unitId`, `lttpSupplierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LttpPartnerPayment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `lttpSupplierId` INTEGER NOT NULL,
    `paymentDate` DATE NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `note` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `LttpPartnerPayment_unitId_lttpSupplierId_paymentDate_idx`(`unitId`, `lttpSupplierId`, `paymentDate`),
    INDEX `LttpPartnerPayment_lttpSupplierId_idx`(`lttpSupplierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LttpPartnerPaymentTotal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `lttpSupplierId` INTEGER NOT NULL,
    `totalPaidAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `LttpPartnerPaymentTotal_unitId_idx`(`unitId`),
    INDEX `LttpPartnerPaymentTotal_lttpSupplierId_idx`(`lttpSupplierId`),
    UNIQUE INDEX `LttpPartnerPaymentTotal_unitId_lttpSupplierId_key`(`unitId`, `lttpSupplierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LttpPartnerDebt` ADD CONSTRAINT `LttpPartnerDebt_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LttpPartnerDebt` ADD CONSTRAINT `LttpPartnerDebt_lttpSupplierId_fkey` FOREIGN KEY (`lttpSupplierId`) REFERENCES `LttpSupplier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `LttpPartnerPayment` ADD CONSTRAINT `LttpPartnerPayment_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LttpPartnerPayment` ADD CONSTRAINT `LttpPartnerPayment_lttpSupplierId_fkey` FOREIGN KEY (`lttpSupplierId`) REFERENCES `LttpSupplier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `LttpPartnerPaymentTotal` ADD CONSTRAINT `LttpPartnerPaymentTotal_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LttpPartnerPaymentTotal` ADD CONSTRAINT `LttpPartnerPaymentTotal_lttpSupplierId_fkey` FOREIGN KEY (`lttpSupplierId`) REFERENCES `LttpSupplier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
