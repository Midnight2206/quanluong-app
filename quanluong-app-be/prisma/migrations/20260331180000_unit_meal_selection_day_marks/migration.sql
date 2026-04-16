-- CreateTable
CREATE TABLE `UnitSelectedMealRate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `mealAllowanceRateId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UnitSelectedMealRate_unitId_idx`(`unitId`),
    UNIQUE INDEX `UnitSelectedMealRate_unitId_mealAllowanceRateId_key`(`unitId`, `mealAllowanceRateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MealRosterDayMark` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mealRosterEntryId` INTEGER NOT NULL,
    `dayOfMonth` INTEGER NOT NULL,
    `mealAllowanceRateId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MealRosterDayMark_mealRosterEntryId_idx`(`mealRosterEntryId`),
    UNIQUE INDEX `MealRosterDayMark_mealRosterEntryId_dayOfMonth_key`(`mealRosterEntryId`, `dayOfMonth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UnitSelectedMealRate` ADD CONSTRAINT `UnitSelectedMealRate_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UnitSelectedMealRate` ADD CONSTRAINT `UnitSelectedMealRate_mealAllowanceRateId_fkey` FOREIGN KEY (`mealAllowanceRateId`) REFERENCES `MealAllowanceRate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MealRosterDayMark` ADD CONSTRAINT `MealRosterDayMark_mealRosterEntryId_fkey` FOREIGN KEY (`mealRosterEntryId`) REFERENCES `MealRosterEntry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MealRosterDayMark` ADD CONSTRAINT `MealRosterDayMark_mealAllowanceRateId_fkey` FOREIGN KEY (`mealAllowanceRateId`) REFERENCES `MealAllowanceRate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: các mức đang dùng trong MealRosterEntry → tập được phép cho từng đơn vị
INSERT INTO `UnitSelectedMealRate` (`unitId`, `mealAllowanceRateId`, `createdAt`)
SELECT DISTINCT `unitId`, `mealAllowanceRateId`, CURRENT_TIMESTAMP(3)
FROM `MealRosterEntry`;
