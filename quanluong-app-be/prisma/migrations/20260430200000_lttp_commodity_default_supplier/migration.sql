-- Bảng liên kết: đối tác mặc định theo từng mặt hàng (thay LttpUnitDefaultSupplier)

CREATE TABLE `LrtpCommodityDefaultSupplier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `commodityId` INTEGER NOT NULL,
    `lttpSupplierId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `LrtpCommodityDefaultSupplier_commodityId_key`(`commodityId`),
    INDEX `LrtpCommodityDefaultSupplier_lttpSupplierId_idx`(`lttpSupplierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LrtpCommodityDefaultSupplier` ADD CONSTRAINT `LrtpCommodityDefaultSupplier_commodityId_fkey` FOREIGN KEY (`commodityId`) REFERENCES `LrtpCommodity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LrtpCommodityDefaultSupplier` ADD CONSTRAINT `LrtpCommodityDefaultSupplier_lttpSupplierId_fkey` FOREIGN KEY (`lttpSupplierId`) REFERENCES `LttpSupplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Chuyển từ đối tác mặc định theo đơn vị sang từng mặt hàng (cùng đơn vị)
INSERT INTO `LrtpCommodityDefaultSupplier` (`commodityId`, `lttpSupplierId`, `createdAt`, `updatedAt`)
SELECT c.`id`, u.`lttpSupplierId`, NOW(3), NOW(3)
FROM `LrtpCommodity` c
INNER JOIN `LttpUnitDefaultSupplier` u ON c.`unitId` = u.`unitId`
WHERE u.`lttpSupplierId` IS NOT NULL;

DROP TABLE `LttpUnitDefaultSupplier`;
