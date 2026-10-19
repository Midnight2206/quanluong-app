-- CreateTable
CREATE TABLE `DataChangeLog` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NULL,
    `unitId` INTEGER NULL,
    `action` VARCHAR(8) NOT NULL,
    `model` VARCHAR(64) NOT NULL,
    `recordId` VARCHAR(191) NULL,
    `changes` JSON NOT NULL,
    `requestId` VARCHAR(64) NULL,
    `route` VARCHAR(128) NULL,
    `ip` VARCHAR(45) NULL,

    INDEX `DataChangeLog_unitId_occurredAt_idx`(`unitId`, `occurredAt`),
    INDEX `DataChangeLog_userId_occurredAt_idx`(`userId`, `occurredAt`),
    INDEX `DataChangeLog_model_recordId_idx`(`model`, `recordId`),
    INDEX `DataChangeLog_action_occurredAt_idx`(`action`, `occurredAt`),
    INDEX `DataChangeLog_occurredAt_idx`(`occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

