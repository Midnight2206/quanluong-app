-- Cấu hình điền template chứng từ quyết toán (Google Doc) theo user.
CREATE TABLE `ChungTuQuyetToanTemplateConfig` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `driveFileId` VARCHAR(128) NOT NULL,
    `fillRulesJson` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`),
    UNIQUE INDEX `ChungTuQuyetToanTemplateConfig_userId_driveFileId_key`(`userId`, `driveFileId`),
    INDEX `ChungTuQuyetToanTemplateConfig_userId_idx`(`userId`),
    CONSTRAINT `ChungTuQuyetToanTemplateConfig_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4;
