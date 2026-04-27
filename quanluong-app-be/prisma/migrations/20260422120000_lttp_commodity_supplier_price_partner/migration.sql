-- AlterTable
ALTER TABLE `LrtpCommodity` ADD COLUMN `defaultLttpSupplierId` INTEGER NULL;

-- AlterTable
ALTER TABLE `LrtpPriceRow` ADD COLUMN `partnerUnitPrice` DECIMAL(18, 2) NULL;

-- AlterTable
ALTER TABLE `LttpIssueSlipLine` ADD COLUMN `lttpSupplierId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `LrtpCommodity_defaultLttpSupplierId_idx` ON `LrtpCommodity`(`defaultLttpSupplierId`);

-- AddForeignKey
ALTER TABLE `LrtpCommodity` ADD CONSTRAINT `LrtpCommodity_defaultLttpSupplierId_fkey` FOREIGN KEY (`defaultLttpSupplierId`) REFERENCES `LttpSupplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LttpIssueSlipLine` ADD CONSTRAINT `LttpIssueSlipLine_lttpSupplierId_fkey` FOREIGN KEY (`lttpSupplierId`) REFERENCES `LttpSupplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
