-- Buổi chấm: sáng / trưa / chiều; dữ liệu cũ gán mặc định buổi trưa (một dấu/ngày trước đây).

ALTER TABLE `MealRosterDayMark` ADD COLUMN `mealPeriod` ENUM('sang', 'trua', 'chieu') NOT NULL DEFAULT 'trua';

ALTER TABLE `MealRosterDayMark` DROP INDEX `MealRosterDayMark_mealRosterEntryId_dayOfMonth_key`;

ALTER TABLE `MealRosterDayMark` ADD UNIQUE INDEX `MealRosterDayMark_uc_edp`(`mealRosterEntryId`, `dayOfMonth`, `mealPeriod`);

ALTER TABLE `MealRosterDayExtraMark` ADD COLUMN `mealPeriod` ENUM('sang', 'trua', 'chieu') NOT NULL DEFAULT 'trua';

ALTER TABLE `MealRosterDayExtraMark` DROP INDEX `MealRosterDayExtra_uc_edr`;

ALTER TABLE `MealRosterDayExtraMark` ADD UNIQUE INDEX `MealRosterDayExtra_uc_edpr`(`mealRosterEntryId`, `dayOfMonth`, `mealPeriod`, `mealAllowanceRateId`);
