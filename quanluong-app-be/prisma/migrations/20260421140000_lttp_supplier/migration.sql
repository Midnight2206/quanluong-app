-- CreateTable
CREATE TABLE `LttpSupplier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `representativeName` VARCHAR(255) NOT NULL,
    `address` VARCHAR(500) NULL,
    `businessLicenseNo` VARCHAR(64) NULL,
    `taxCode` VARCHAR(32) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LttpSupplier` ADD CONSTRAINT `LttpSupplier_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `LttpSupplier_unitId_idx` ON `LttpSupplier`(`unitId`);
