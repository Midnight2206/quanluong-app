-- CreateTable
CREATE TABLE `AuthEventLog` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `type` ENUM('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT') NOT NULL,
    `method` VARCHAR(16) NOT NULL,
    `userId` INTEGER NULL,
    `unitId` INTEGER NULL,
    `identifier` VARCHAR(64) NULL,
    `failReason` VARCHAR(32) NULL,
    `sessionId` VARCHAR(64) NULL,
    `ip` VARCHAR(45) NULL,
    `userAgent` VARCHAR(512) NULL,

    INDEX `AuthEventLog_unitId_occurredAt_idx`(`unitId`, `occurredAt`),
    INDEX `AuthEventLog_userId_occurredAt_idx`(`userId`, `occurredAt`),
    INDEX `AuthEventLog_type_occurredAt_idx`(`type`, `occurredAt`),
    INDEX `AuthEventLog_occurredAt_idx`(`occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

