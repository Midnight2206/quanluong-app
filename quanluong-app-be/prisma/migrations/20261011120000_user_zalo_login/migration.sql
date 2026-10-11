-- AlterTable
ALTER TABLE `User` MODIFY `email` VARCHAR(191) NULL;
ALTER TABLE `User` MODIFY `password` VARCHAR(191) NULL;
ALTER TABLE `User` ADD COLUMN `zaloUserId` VARCHAR(64) NULL;
ALTER TABLE `User` ADD COLUMN `phoneVerifiedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_zaloUserId_key` ON `User`(`zaloUserId`);
