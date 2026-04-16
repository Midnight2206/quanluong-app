-- Lịch sử tỉ lệ chia S/T/C theo ngày áp dụng; dữ liệu cũ migrate về mốc 1970-01-01
CREATE TABLE `UnitMealPeriodSplit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `mealAllowanceRateId` INTEGER NOT NULL,
    `validFrom` DATE NOT NULL,
    `periodAmountsJson` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UmPeriodSplit_uc_ujv`(`unitId`, `mealAllowanceRateId`, `validFrom`),
    INDEX `UnitMealPeriodSplit_unit_rate_idx`(`unitId`, `mealAllowanceRateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `UnitMealPeriodSplit` ADD CONSTRAINT `UnitMealPeriodSplit_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `UnitMealPeriodSplit` ADD CONSTRAINT `UnitMealPeriodSplit_mealAllowanceRateId_fkey` FOREIGN KEY (`mealAllowanceRateId`) REFERENCES `MealAllowanceRate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO `UnitMealPeriodSplit` (`unitId`, `mealAllowanceRateId`, `validFrom`, `periodAmountsJson`)
SELECT `unitId`, `mealAllowanceRateId`, '1970-01-01', `periodAmountsJson`
FROM `UnitSelectedMealRate`
WHERE `periodAmountsJson` IS NOT NULL;

ALTER TABLE `UnitSelectedMealRate` DROP COLUMN `periodAmountsJson`;
