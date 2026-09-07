-- AlterTable
ALTER TABLE `ChungTuBkmhSlice` ADD COLUMN `buyerUserId` INTEGER NULL,
    ADD COLUMN `buyerKey` VARCHAR(191) NULL,
    ADD COLUMN `buyerName` VARCHAR(191) NULL,
    ADD COLUMN `buyerSignatureName` VARCHAR(255) NULL,
    ADD COLUMN `buyerTitle` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `ChungTuSignatureSettings` ADD COLUMN `extraFieldsJson` JSON NULL;
