-- CreateTable
CREATE TABLE `MealRosterDayExtraMark` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mealRosterEntryId` INTEGER NOT NULL,
    `dayOfMonth` INTEGER NOT NULL,
    `mealAllowanceRateId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MealRosterDayExtraMark_mealRosterEntryId_idx`(`mealRosterEntryId`),
    UNIQUE INDEX `MealRosterDayExtra_uc_edr`(`mealRosterEntryId`, `dayOfMonth`, `mealAllowanceRateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MealRosterDayExtraMark` ADD CONSTRAINT `MealRosterDayExtraMark_mealRosterEntryId_fkey` FOREIGN KEY (`mealRosterEntryId`) REFERENCES `MealRosterEntry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MealRosterDayExtraMark` ADD CONSTRAINT `MealRosterDayExtraMark_mealAllowanceRateId_fkey` FOREIGN KEY (`mealAllowanceRateId`) REFERENCES `MealAllowanceRate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Chuyển dấu cũ là «ăn thêm» sang bảng mới; xóa khỏi MealRosterDayMark (một ô chỉ còn tiêu chuẩn hoặc trống)
INSERT INTO `MealRosterDayExtraMark` (`mealRosterEntryId`, `dayOfMonth`, `mealAllowanceRateId`, `createdAt`)
SELECT `m`.`mealRosterEntryId`, `m`.`dayOfMonth`, `m`.`mealAllowanceRateId`, CURRENT_TIMESTAMP(3)
FROM `MealRosterDayMark` `m`
INNER JOIN `MealAllowanceRate` `r` ON `r`.`id` = `m`.`mealAllowanceRateId`
WHERE `r`.`type` = 'an_them';

DELETE `m` FROM `MealRosterDayMark` `m`
INNER JOIN `MealAllowanceRate` `r` ON `r`.`id` = `m`.`mealAllowanceRateId`
WHERE `r`.`type` = 'an_them';
