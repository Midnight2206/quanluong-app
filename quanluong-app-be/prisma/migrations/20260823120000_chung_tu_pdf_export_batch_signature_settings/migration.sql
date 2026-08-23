-- CreateTable
CREATE TABLE `ChungTuPdfExportBatch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `batchKey` VARCHAR(200) NOT NULL,
    `categoryKey` VARCHAR(80) NOT NULL,
    `unitId` INTEGER NOT NULL,
    `periodMonth` VARCHAR(7) NULL,
    `periodDate` DATE NULL,
    `issueSlipId` INTEGER NULL,
    `unitIdsJson` JSON NOT NULL,
    `aggregationMode` VARCHAR(32) NULL,
    `pdfTemplateId` INTEGER NOT NULL,
    `documentServiceTemplateId` INTEGER NOT NULL,
    `documentServiceFolderId` INTEGER NOT NULL,
    `displayName` VARCHAR(255) NOT NULL,
    `fileCount` INTEGER NOT NULL,
    `sourceDataHash` VARCHAR(64) NULL,
    `signaturesJson` JSON NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChungTuPdfExportBatch_batchKey_key`(`batchKey`),
    INDEX `ChungTuPdfExportBatch_categoryKey_unitId_createdAt_idx`(`categoryKey`, `unitId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChungTuSignatureSettings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `categoryKey` VARCHAR(80) NOT NULL,
    `signatureBlockJson` JSON NOT NULL,
    `updatedById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChungTuSignatureSettings_categoryKey_key`(`categoryKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `ChungTuPdfExport` MODIFY `storagePath` VARCHAR(512) NULL,
    ADD COLUMN `batchId` INTEGER NULL,
    ADD COLUMN `documentServiceFileId` INTEGER NULL,
    ADD COLUMN `sortKey` VARCHAR(128) NULL;

-- CreateIndex
CREATE INDEX `ChungTuPdfExport_batchId_idx` ON `ChungTuPdfExport`(`batchId`);

-- AddForeignKey
ALTER TABLE `ChungTuPdfExportBatch` ADD CONSTRAINT `ChungTuPdfExportBatch_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChungTuPdfExportBatch` ADD CONSTRAINT `ChungTuPdfExportBatch_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChungTuSignatureSettings` ADD CONSTRAINT `ChungTuSignatureSettings_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChungTuPdfExport` ADD CONSTRAINT `ChungTuPdfExport_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `ChungTuPdfExportBatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
