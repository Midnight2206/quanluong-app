-- Trợ lý làm sổ: hội thoại, ghi nhớ, quy tắc riêng tài khoản. Thống kê dùng không chứa nội dung.
CREATE TABLE `LedgerAssistantProfile` (
    `userId` INTEGER NOT NULL,
    `unitId` INTEGER NOT NULL,
    `displayName` VARCHAR(40) NOT NULL DEFAULT 'Trợ lý làm sổ',
    `tone` VARCHAR(16) NOT NULL DEFAULT 'ngan_gon',
    `preferences` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`, `unitId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LedgerAssistantMemory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `unitId` INTEGER NOT NULL,
    `fact` VARCHAR(240) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LedgerAssistantMemory_userId_unitId_idx`(`userId`, `unitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LedgerAssistantRuleNote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `unitId` INTEGER NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LedgerAssistantRuleNote_userId_unitId_createdAt_idx`(`userId`, `unitId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LedgerAssistantConversation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `unitId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LedgerAssistantConversation_userId_unitId_updatedAt_idx`(`userId`, `unitId`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LedgerAssistantMessage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conversationId` INTEGER NOT NULL,
    `role` VARCHAR(16) NOT NULL,
    `kind` VARCHAR(32) NOT NULL,
    `content` TEXT NOT NULL,
    `payloadJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LedgerAssistantMessage_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LedgerAssistantUsage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `unitId` INTEGER NOT NULL,
    `feature` VARCHAR(64) NOT NULL,
    `provider` VARCHAR(16) NOT NULL,
    `model` VARCHAR(80) NOT NULL,
    `inputSha256` VARCHAR(64) NOT NULL,
    `inputBytes` INTEGER NOT NULL,
    `status` VARCHAR(16) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LedgerAssistantUsage_unitId_createdAt_idx`(`unitId`, `createdAt`),
    INDEX `LedgerAssistantUsage_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `LedgerAssistantUsage_feature_createdAt_idx`(`feature`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LedgerAssistantProfile` ADD CONSTRAINT `LedgerAssistantProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LedgerAssistantProfile` ADD CONSTRAINT `LedgerAssistantProfile_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LedgerAssistantMemory` ADD CONSTRAINT `LedgerAssistantMemory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LedgerAssistantMemory` ADD CONSTRAINT `LedgerAssistantMemory_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LedgerAssistantRuleNote` ADD CONSTRAINT `LedgerAssistantRuleNote_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LedgerAssistantRuleNote` ADD CONSTRAINT `LedgerAssistantRuleNote_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LedgerAssistantConversation` ADD CONSTRAINT `LedgerAssistantConversation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LedgerAssistantConversation` ADD CONSTRAINT `LedgerAssistantConversation_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LedgerAssistantMessage` ADD CONSTRAINT `LedgerAssistantMessage_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `LedgerAssistantConversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LedgerAssistantUsage` ADD CONSTRAINT `LedgerAssistantUsage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LedgerAssistantUsage` ADD CONSTRAINT `LedgerAssistantUsage_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
