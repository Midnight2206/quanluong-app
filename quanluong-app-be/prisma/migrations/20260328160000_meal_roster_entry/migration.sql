-- CreateTable
CREATE TABLE `MealRosterEntry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `yearMonth` CHAR(7) NOT NULL,
    `fullName` VARCHAR(255) NOT NULL,
    `rank` VARCHAR(128) NOT NULL,
    `regularMealAmount` INTEGER NOT NULL,
    `unitDisplay` VARCHAR(255) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MealRosterEntry_unitId_yearMonth_idx`(`unitId`, `yearMonth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MealRosterEntry` ADD CONSTRAINT `MealRosterEntry_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
