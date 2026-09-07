-- AlterTable
ALTER TABLE `ChungTuPdfExport`
    ADD COLUMN `contextJson` JSON NULL;

-- CreateTable
CREATE TABLE `ChungTuDocNumberCounter` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `categoryKey` VARCHAR(80) NOT NULL,
    `quyenSo` VARCHAR(8) NOT NULL,
    `nextSeq` INTEGER NOT NULL DEFAULT 1,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChungTuDocNumberCounter_unitId_categoryKey_quyenSo_key`(`unitId`, `categoryKey`, `quyenSo`),
    INDEX `ChungTuDocNumberCounter_unitId_categoryKey_idx`(`unitId`, `categoryKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChungTuDocNumberAssignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `categoryKey` VARCHAR(80) NOT NULL,
    `quyenSo` VARCHAR(8) NOT NULL,
    `sheetKey` VARCHAR(191) NOT NULL,
    `seq` INTEGER NOT NULL,
    `soChungTu` VARCHAR(16) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ChungTuDocNumberAssignment_unitId_categoryKey_quyenSo_sheetKey_key`(`unitId`, `categoryKey`, `quyenSo`, `sheetKey`),
    INDEX `ChungTuDocNumberAssignment_unitId_categoryKey_quyenSo_idx`(`unitId`, `categoryKey`, `quyenSo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ChungTuDocNumberCounter` ADD CONSTRAINT `ChungTuDocNumberCounter_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChungTuDocNumberAssignment` ADD CONSTRAINT `ChungTuDocNumberAssignment_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
