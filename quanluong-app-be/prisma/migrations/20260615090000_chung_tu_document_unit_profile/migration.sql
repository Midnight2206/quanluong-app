-- CreateTable
CREATE TABLE `ChungTuUnitProfile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `donViCapTren` VARCHAR(255) NULL,
    `hoTenNguoiMua` VARCHAR(191) NULL,
    `boPhan` VARCHAR(255) NULL,
    `mauSo` VARCHAR(64) NULL,
    `quyenSo` VARCHAR(32) NULL,
    `noTaiKhoan` VARCHAR(128) NULL,
    `coTaiKhoan` VARCHAR(128) NULL,
    `signerLabelWriter` VARCHAR(128) NULL,
    `signerLabelApprover` VARCHAR(128) NULL,
    `signerLabelThird` VARCHAR(128) NULL,
    `signerWriter` VARCHAR(191) NULL,
    `signerApprover` VARCHAR(191) NULL,
    `signerThird` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChungTuUnitProfile_unitId_key`(`unitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChungTuDocument` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `documentKey` VARCHAR(200) NOT NULL,
    `unitId` INTEGER NOT NULL,
    `categoryKey` VARCHAR(80) NOT NULL,
    `periodDate` DATE NULL,
    `issueSlipId` INTEGER NULL,
    `templateDriveFileId` VARCHAR(128) NOT NULL,
    `templateName` VARCHAR(255) NULL,
    `outputDriveFileId` VARCHAR(128) NULL,
    `outputWebViewLink` VARCHAR(1024) NULL,
    `settingsJson` JSON NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'draft',
    `lastSyncedAt` DATETIME(3) NULL,
    `sourceDataHash` VARCHAR(64) NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChungTuDocument_documentKey_key`(`documentKey`),
    INDEX `ChungTuDocument_unitId_categoryKey_periodDate_idx`(`unitId`, `categoryKey`, `periodDate`),
    INDEX `ChungTuDocument_issueSlipId_idx`(`issueSlipId`),
    INDEX `ChungTuDocument_unitId_categoryKey_idx`(`unitId`, `categoryKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ChungTuUnitProfile` ADD CONSTRAINT `ChungTuUnitProfile_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChungTuDocument` ADD CONSTRAINT `ChungTuDocument_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChungTuDocument` ADD CONSTRAINT `ChungTuDocument_issueSlipId_fkey` FOREIGN KEY (`issueSlipId`) REFERENCES `LttpIssueSlip`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChungTuDocument` ADD CONSTRAINT `ChungTuDocument_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
