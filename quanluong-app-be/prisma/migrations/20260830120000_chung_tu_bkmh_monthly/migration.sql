-- CreateTable
CREATE TABLE `ChungTuBkmhMonthly` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `storageUnitId` INTEGER NOT NULL,
    `periodMonth` VARCHAR(7) NOT NULL,
    `aggregationMode` VARCHAR(32) NOT NULL,
    `unitIdsJson` JSON NOT NULL,
    `pdfTemplateId` INTEGER NOT NULL,
    `documentServiceTemplateId` INTEGER NOT NULL,
    `documentServiceFolderId` INTEGER NOT NULL,
    `displayName` VARCHAR(255) NOT NULL,
    `tongTienThang` DECIMAL(18, 2) NULL,
    `sliceCount` INTEGER NOT NULL,
    `sourceDataHash` VARCHAR(64) NULL,
    `signaturesJson` JSON NULL,
    `createdById` INTEGER NOT NULL,
    `updatedById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChungTuBkmhMonthly_storageUnitId_periodMonth_key`(`storageUnitId`, `periodMonth`),
    INDEX `ChungTuBkmhMonthly_storageUnitId_updatedAt_idx`(`storageUnitId`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChungTuBkmhSlice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `monthlyId` INTEGER NOT NULL,
    `sortKey` VARCHAR(128) NOT NULL,
    `soChungTu` VARCHAR(64) NULL,
    `periodDate` DATE NULL,
    `recipientUnitId` INTEGER NULL,
    `recipientUnitName` VARCHAR(255) NULL,
    `ngayThangNam` VARCHAR(128) NULL,
    `tongTien` DECIMAL(18, 2) NULL,
    `documentServiceFileId` INTEGER NOT NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChungTuBkmhSlice_monthlyId_sortKey_key`(`monthlyId`, `sortKey`),
    INDEX `ChungTuBkmhSlice_monthlyId_idx`(`monthlyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ChungTuBkmhMonthly` ADD CONSTRAINT `ChungTuBkmhMonthly_storageUnitId_fkey` FOREIGN KEY (`storageUnitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChungTuBkmhMonthly` ADD CONSTRAINT `ChungTuBkmhMonthly_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChungTuBkmhMonthly` ADD CONSTRAINT `ChungTuBkmhMonthly_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChungTuBkmhSlice` ADD CONSTRAINT `ChungTuBkmhSlice_monthlyId_fkey` FOREIGN KEY (`monthlyId`) REFERENCES `ChungTuBkmhMonthly`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
