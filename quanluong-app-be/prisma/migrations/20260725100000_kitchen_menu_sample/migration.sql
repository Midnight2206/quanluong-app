CREATE TABLE `KitchenMenuSample` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `mealPeriod` ENUM('sang', 'trua', 'chieu') NOT NULL,
    `mealAllowanceRateId` INTEGER NOT NULL,
    `dishesJson` JSON NOT NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KitchenMenuSample_unitId_mealPeriod_idx`(`unitId`, `mealPeriod`),
    INDEX `KitchenMenuSample_mealAllowanceRateId_idx`(`mealAllowanceRateId`),
    INDEX `KitchenMenuSample_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `KitchenMenuSample` ADD CONSTRAINT `KitchenMenuSample_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `KitchenMenuSample` ADD CONSTRAINT `KitchenMenuSample_mealAllowanceRateId_fkey` FOREIGN KEY (`mealAllowanceRateId`) REFERENCES `MealAllowanceRate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `KitchenMenuSample` ADD CONSTRAINT `KitchenMenuSample_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
