-- CreateTable
CREATE TABLE `ChungTuTemplateFillConfig` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `categoryKey` VARCHAR(80) NOT NULL,
    `driveFileId` VARCHAR(128) NOT NULL,
    `templateName` VARCHAR(255) NULL,
    `fillRulesJson` JSON NOT NULL,
    `updatedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChungTuTemplateFillConfig_categoryKey_driveFileId_key`(`categoryKey`, `driveFileId`),
    INDEX `ChungTuTemplateFillConfig_categoryKey_idx`(`categoryKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ChungTuTemplateFillConfig` ADD CONSTRAINT `ChungTuTemplateFillConfig_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
