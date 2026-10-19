-- CreateTable
CREATE TABLE `UsageEvent` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `occurredAt` DATETIME(3) NOT NULL,
    `userId` INTEGER NOT NULL,
    `unitId` INTEGER NULL,
    `sessionId` VARCHAR(64) NULL,
    `kind` VARCHAR(16) NOT NULL,
    `path` VARCHAR(255) NOT NULL,
    `label` VARCHAR(128) NULL,

    INDEX `UsageEvent_unitId_occurredAt_idx`(`unitId`, `occurredAt`),
    INDEX `UsageEvent_userId_occurredAt_idx`(`userId`, `occurredAt`),
    INDEX `UsageEvent_occurredAt_idx`(`occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UsageSessionDaily` (
    `userId` INTEGER NOT NULL,
    `day` DATE NOT NULL,
    `unitId` INTEGER NULL,
    `activeSec` INTEGER NOT NULL DEFAULT 0,
    `pageViews` INTEGER NOT NULL DEFAULT 0,
    `firstSeenAt` DATETIME(3) NOT NULL,
    `lastSeenAt` DATETIME(3) NOT NULL,

    INDEX `UsageSessionDaily_unitId_day_idx`(`unitId`, `day`),
    INDEX `UsageSessionDaily_day_idx`(`day`),
    PRIMARY KEY (`userId`, `day`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

