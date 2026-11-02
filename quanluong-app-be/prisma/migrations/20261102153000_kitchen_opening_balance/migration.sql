-- Tồn đầu kỳ: một lần khi đơn vị chưa có phiếu. Không phải số lượng nhập tay trên sổ.

CREATE TABLE `KitchenOpeningBalance` (
  `unitId` INTEGER NOT NULL,
  `createdById` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`unitId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `KitchenOpeningBalanceLine` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `unitId` INTEGER NOT NULL,
  `commodityId` INTEGER NOT NULL,
  `quantity` DECIMAL(18, 4) NOT NULL,
  `unitPrice` DECIMAL(18, 2) NOT NULL,

  UNIQUE INDEX `KitchenOpeningBalanceLine_unitId_commodityId_key`(`unitId`, `commodityId`),
  INDEX `KitchenOpeningBalanceLine_commodityId_idx`(`commodityId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `KitchenOpeningBalance` ADD CONSTRAINT `KitchenOpeningBalance_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `KitchenOpeningBalance` ADD CONSTRAINT `KitchenOpeningBalance_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `KitchenOpeningBalanceLine` ADD CONSTRAINT `KitchenOpeningBalanceLine_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `KitchenOpeningBalance`(`unitId`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `KitchenOpeningBalanceLine` ADD CONSTRAINT `KitchenOpeningBalanceLine_commodityId_fkey` FOREIGN KEY (`commodityId`) REFERENCES `LrtpCommodity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
