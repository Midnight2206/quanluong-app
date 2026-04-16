-- CreateTable
CREATE TABLE `UnitLevelPermissionCap` (
    `depth` INTEGER NOT NULL,
    `permissionId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`depth`, `permissionId`),
    INDEX `UnitLevelPermissionCap_permissionId_idx` (`permissionId`),
    CONSTRAINT `UnitLevelPermissionCap_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
