-- Gộp dấu ăn thêm theo người+ngày (bỏ mealPeriod); thêm cấu hình chia buổi theo ngày cho cả danh sách.

DELETE `e1` FROM `MealRosterDayExtraMark` `e1`
INNER JOIN `MealRosterDayExtraMark` `e2`
  ON `e1`.`mealRosterEntryId` = `e2`.`mealRosterEntryId`
  AND `e1`.`dayOfMonth` = `e2`.`dayOfMonth`
  AND `e1`.`mealAllowanceRateId` = `e2`.`mealAllowanceRateId`
  AND `e1`.`id` > `e2`.`id`;

ALTER TABLE `MealRosterDayExtraMark` DROP INDEX `MealRosterDayExtra_uc_edpr`;

ALTER TABLE `MealRosterDayExtraMark` DROP COLUMN `mealPeriod`;

ALTER TABLE `MealRosterDayExtraMark` ADD UNIQUE INDEX `MealRosterDayExtra_uc_edr`(`mealRosterEntryId`, `dayOfMonth`, `mealAllowanceRateId`);

CREATE TABLE `MealRosterDayExtraSplit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `yearMonth` CHAR(7) NOT NULL,
    `dayOfMonth` INTEGER NOT NULL,
    `periodsJson` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MealRosterDayExtraSplit_unitId_yearMonth_idx`(`unitId`, `yearMonth`),
    UNIQUE INDEX `MealRosterDayExtraSplit_uc_udy`(`unitId`, `yearMonth`, `dayOfMonth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MealRosterDayExtraSplit` ADD CONSTRAINT `MealRosterDayExtraSplit_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
