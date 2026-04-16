-- Trạng thái đã đọc 1–1 (lastReadAt null = chưa từng mở thread)
CREATE TABLE `ChatDirectReadState` (
    `userId` INTEGER NOT NULL,
    `peerUserId` INTEGER NOT NULL,
    `lastReadAt` DATETIME(3) NULL,

    PRIMARY KEY (`userId`, `peerUserId`),
    INDEX `ChatDirectReadState_userId_idx`(`userId`),
    INDEX `ChatDirectReadState_peerUserId_idx`(`peerUserId`),
    CONSTRAINT `ChatDirectReadState_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `ChatDirectReadState_peerUserId_fkey` FOREIGN KEY (`peerUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4;

CREATE TABLE `ChatGroup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    INDEX `ChatGroup_createdById_idx`(`createdById`),
    CONSTRAINT `ChatGroup_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4;

CREATE TABLE `ChatGroupMember` (
    `groupId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastReadAt` DATETIME(3) NULL,

    PRIMARY KEY (`groupId`, `userId`),
    INDEX `ChatGroupMember_userId_idx`(`userId`),
    CONSTRAINT `ChatGroupMember_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `ChatGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `ChatGroupMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4;

CREATE TABLE `ChatGroupMessage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `groupId` INTEGER NOT NULL,
    `senderId` INTEGER NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    INDEX `ChatGroupMessage_groupId_createdAt_idx`(`groupId`, `createdAt`),
    CONSTRAINT `ChatGroupMessage_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `ChatGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `ChatGroupMessage_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4;
