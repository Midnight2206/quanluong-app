-- CreateTable
CREATE TABLE `ChungTuPdfTemplate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `categoryKey` VARCHAR(80) NOT NULL,
    `displayName` VARCHAR(200) NOT NULL,
    `documentServiceTemplateId` INTEGER NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `version` VARCHAR(64) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `uploadedById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ChungTuPdfTemplate_categoryKey_isActive_idx`(`categoryKey`, `isActive`),
    UNIQUE INDEX `ChungTuPdfTemplate_categoryKey_documentServiceTemplateId_key`(`categoryKey`, `documentServiceTemplateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChungTuPdfExport` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exportKey` VARCHAR(200) NOT NULL,
    `categoryKey` VARCHAR(80) NOT NULL,
    `unitId` INTEGER NOT NULL,
    `periodMonth` VARCHAR(7) NULL,
    `periodDate` DATE NULL,
    `issueSlipId` INTEGER NULL,
    `unitIdsJson` JSON NOT NULL,
    `aggregationMode` VARCHAR(32) NULL,
    `pdfTemplateId` INTEGER NOT NULL,
    `documentServiceTemplateId` INTEGER NOT NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `storagePath` VARCHAR(512) NOT NULL,
    `sourceDataHash` VARCHAR(64) NULL,
    `signaturesJson` JSON NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChungTuPdfExport_exportKey_key`(`exportKey`),
    INDEX `ChungTuPdfExport_categoryKey_unitId_createdAt_idx`(`categoryKey`, `unitId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ChungTuPdfTemplate` ADD CONSTRAINT `ChungTuPdfTemplate_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChungTuPdfExport` ADD CONSTRAINT `ChungTuPdfExport_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChungTuPdfExport` ADD CONSTRAINT `ChungTuPdfExport_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
