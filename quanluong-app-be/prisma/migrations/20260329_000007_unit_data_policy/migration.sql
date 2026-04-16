-- UnitDataPolicyPeriod: lịch sử INDEPENDENT vs INHERIT_PRIVATE theo khoảng thời gian
CREATE TABLE `UnitDataPolicyPeriod` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `policy` ENUM('INDEPENDENT', 'INHERIT_PRIVATE') NOT NULL,
    `validFrom` DATETIME(3) NOT NULL,
    `validTo` DATETIME(3) NULL,
    `note` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UnitDataPolicyPeriod_unitId_validFrom_idx`(`unitId`, `validFrom`),
    INDEX `UnitDataPolicyPeriod_unitId_validTo_idx`(`unitId`, `validTo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `UnitDataPolicyPeriod` ADD CONSTRAINT `UnitDataPolicyPeriod_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- UnitPrivateDataShareGrant: gán đọc private của owner cho consumer (theo kind / bản ghi)
CREATE TABLE `UnitPrivateDataShareGrant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ownerUnitId` INTEGER NOT NULL,
    `consumerUnitId` INTEGER NOT NULL,
    `dataKind` VARCHAR(64) NOT NULL,
    `recordId` INTEGER NULL,
    `validFrom` DATETIME(3) NOT NULL,
    `validTo` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UnitPrivateDataShareGrant_consumer_dataKind_validFrom_idx`(`consumerUnitId`, `dataKind`, `validFrom`),
    INDEX `UnitPrivateDataShareGrant_owner_dataKind_idx`(`ownerUnitId`, `dataKind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `UnitPrivateDataShareGrant` ADD CONSTRAINT `UnitPrivateDataShareGrant_ownerUnitId_fkey` FOREIGN KEY (`ownerUnitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `UnitPrivateDataShareGrant` ADD CONSTRAINT `UnitPrivateDataShareGrant_consumerUnitId_fkey` FOREIGN KEY (`consumerUnitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
