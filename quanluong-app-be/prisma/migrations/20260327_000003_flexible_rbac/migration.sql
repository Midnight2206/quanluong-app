-- CreateTable UnitLevelMetadata
CREATE TABLE `UnitLevelMetadata` (
    `depth` INTEGER NOT NULL,
    `label` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`depth`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable JobTitle (before User.jobTitleId FK)
CREATE TABLE `JobTitle` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `JobTitle_unitId_name_key`(`unitId`, `name`),
    INDEX `JobTitle_unitId_idx`(`unitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable JobTitlePermission
CREATE TABLE `JobTitlePermission` (
    `jobTitleId` INTEGER NOT NULL,
    `permissionId` INTEGER NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `JobTitlePermission_permissionId_idx`(`permissionId`),
    PRIMARY KEY (`jobTitleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `JobTitle` ADD CONSTRAINT `JobTitle_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `JobTitlePermission` ADD CONSTRAINT `JobTitlePermission_jobTitleId_fkey` FOREIGN KEY (`jobTitleId`) REFERENCES `JobTitle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `JobTitlePermission` ADD CONSTRAINT `JobTitlePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable User
ALTER TABLE `User` ADD COLUMN `jobTitleId` INTEGER NULL;
ALTER TABLE `User` ADD COLUMN `registrationStatus` ENUM('PENDING_APPROVAL', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED';
ALTER TABLE `User` ADD COLUMN `registrationReviewedAt` DATETIME(3) NULL;
ALTER TABLE `User` ADD COLUMN `registrationReviewNote` VARCHAR(500) NULL;
ALTER TABLE `User` ADD COLUMN `registrationReviewedById` INTEGER NULL;

CREATE INDEX `User_jobTitleId_idx` ON `User`(`jobTitleId`);
CREATE INDEX `User_registrationStatus_idx` ON `User`(`registrationStatus`);

ALTER TABLE `User` ADD CONSTRAINT `User_jobTitleId_fkey` FOREIGN KEY (`jobTitleId`) REFERENCES `JobTitle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `User` ADD CONSTRAINT `User_registrationReviewedById_fkey` FOREIGN KEY (`registrationReviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
