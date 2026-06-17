CREATE TABLE `ChungTuExcelTemplate` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `categoryKey` VARCHAR(80) NOT NULL,
  `displayName` VARCHAR(200) NOT NULL,
  `originalFilename` VARCHAR(255) NOT NULL,
  `storagePath` VARCHAR(1024) NOT NULL,
  `fileSize` INT NOT NULL,
  `checksum` VARCHAR(64) NOT NULL,
  `metadataJson` JSON NOT NULL,
  `mappingJson` JSON NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdById` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `ChungTuExcelTemplate_categoryKey_isActive_updatedAt_idx` (`categoryKey`, `isActive`, `updatedAt`),
  INDEX `ChungTuExcelTemplate_createdById_idx` (`createdById`),
  INDEX `ChungTuExcelTemplate_checksum_idx` (`checksum`),
  CONSTRAINT `ChungTuExcelTemplate_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ChungTuExcelExportHistory` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `templateId` INT NOT NULL,
  `categoryKey` VARCHAR(80) NOT NULL,
  `periodMonth` VARCHAR(7) NOT NULL,
  `unitIdsJson` JSON NOT NULL,
  `lineCount` INT NOT NULL DEFAULT 0,
  `totalAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  `metadataJson` JSON NULL,
  `createdById` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `ChungTuExcelExportHistory_categoryKey_periodMonth_idx` (`categoryKey`, `periodMonth`),
  INDEX `ChungTuExcelExportHistory_templateId_createdAt_idx` (`templateId`, `createdAt`),
  INDEX `ChungTuExcelExportHistory_createdById_createdAt_idx` (`createdById`, `createdAt`),
  CONSTRAINT `ChungTuExcelExportHistory_templateId_fkey`
    FOREIGN KEY (`templateId`) REFERENCES `ChungTuExcelTemplate` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ChungTuExcelExportHistory_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
