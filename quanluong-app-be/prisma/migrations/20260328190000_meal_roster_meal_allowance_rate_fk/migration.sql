-- AlterTable: mức tiền ăn -> FK MealAllowanceRate (ăn tiêu chuẩn)
ALTER TABLE `MealRosterEntry` ADD COLUMN `mealAllowanceRateId` INTEGER NULL;

UPDATE `MealRosterEntry`
SET `mealAllowanceRateId` = (
  SELECT `id` FROM (
    SELECT `id` FROM `MealAllowanceRate` WHERE `type` = 'an_tieu_chuan' ORDER BY `sortOrder` ASC, `id` ASC LIMIT 1
  ) AS `_pick`
)
WHERE `mealAllowanceRateId` IS NULL;

ALTER TABLE `MealRosterEntry` DROP COLUMN `regularMealAmount`;

ALTER TABLE `MealRosterEntry` MODIFY `mealAllowanceRateId` INTEGER NOT NULL;

CREATE INDEX `MealRosterEntry_mealAllowanceRateId_idx` ON `MealRosterEntry`(`mealAllowanceRateId`);

ALTER TABLE `MealRosterEntry` ADD CONSTRAINT `MealRosterEntry_mealAllowanceRateId_fkey` FOREIGN KEY (`mealAllowanceRateId`) REFERENCES `MealAllowanceRate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
