-- Danh mục link template chứng từ (Drive hệ thống) — superadmin cấu hình tên + URL.
CREATE TABLE `ChungTuDriveTemplateLink` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `categoryKey` VARCHAR(80) NOT NULL,
    `displayName` VARCHAR(200) NOT NULL,
    `driveFileId` VARCHAR(128) NOT NULL,
    `linkUrl` TEXT NOT NULL,
    `mimeType` VARCHAR(128) NULL,
    `webViewLink` VARCHAR(1024) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChungTuDriveTemplateLink_categoryKey_driveFileId_key`(`categoryKey`, `driveFileId`),
    INDEX `ChungTuDriveTemplateLink_categoryKey_isActive_sortOrder_idx`(`categoryKey`, `isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
