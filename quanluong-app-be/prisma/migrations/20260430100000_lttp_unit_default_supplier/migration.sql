-- CreateTable: một bản ghi / đơn vị (đối tác mặc định chung, không còn trên LrtpCommodity)
CREATE TABLE `LttpUnitDefaultSupplier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `lttpSupplierId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `LttpUnitDefaultSupplier_unitId_key`(`unitId`),
    INDEX `LttpUnitDefaultSupplier_lttpSupplierId_idx`(`lttpSupplierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Data migration: 1 giá trị/đơn vị từ cột cũ (MIN để ổn định)
INSERT INTO `LttpUnitDefaultSupplier` (`unitId`, `lttpSupplierId`, `createdAt`, `updatedAt`)
SELECT `unitId`, MIN(`defaultLttpSupplierId`), NOW(3), NOW(3)
FROM `LrtpCommodity`
WHERE `defaultLttpSupplierId` IS NOT NULL
GROUP BY `unitId`;

-- Drop FK + column cũ
ALTER TABLE `LrtpCommodity` DROP FOREIGN KEY `LrtpCommodity_defaultLttpSupplierId_fkey`;
ALTER TABLE `LrtpCommodity` DROP INDEX `LrtpCommodity_defaultLttpSupplierId_idx`;
ALTER TABLE `LrtpCommodity` DROP COLUMN `defaultLttpSupplierId`;

-- AddForeignKey
ALTER TABLE `LttpUnitDefaultSupplier` ADD CONSTRAINT `LttpUnitDefaultSupplier_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LttpUnitDefaultSupplier` ADD CONSTRAINT `LttpUnitDefaultSupplier_lttpSupplierId_fkey` FOREIGN KEY (`lttpSupplierId`) REFERENCES `LttpSupplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
