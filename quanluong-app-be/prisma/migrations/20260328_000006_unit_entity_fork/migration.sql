-- CreateTable UnitEntityFork
CREATE TABLE `UnitEntityFork` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kind` ENUM('JOB_TITLE', 'LTTP_COMMODITY', 'LTTP_PRICE_TABLE') NOT NULL,
    `sourceRecordId` INTEGER NOT NULL,
    `sourceUnitId` INTEGER NOT NULL,
    `targetUnitId` INTEGER NOT NULL,
    `targetRecordId` INTEGER NOT NULL,
    `appliedByUserId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UnitEntityFork_kind_sourceRecordId_targetUnitId_key`(`kind`, `sourceRecordId`, `targetUnitId`),
    INDEX `UnitEntityFork_targetUnitId_kind_idx`(`targetUnitId`, `kind`),
    INDEX `UnitEntityFork_sourceUnitId_idx`(`sourceUnitId`),
    INDEX `UnitEntityFork_appliedByUserId_idx`(`appliedByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `UnitEntityFork` ADD CONSTRAINT `UnitEntityFork_sourceUnitId_fkey` FOREIGN KEY (`sourceUnitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `UnitEntityFork` ADD CONSTRAINT `UnitEntityFork_targetUnitId_fkey` FOREIGN KEY (`targetUnitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `UnitEntityFork` ADD CONSTRAINT `UnitEntityFork_appliedByUserId_fkey` FOREIGN KEY (`appliedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
