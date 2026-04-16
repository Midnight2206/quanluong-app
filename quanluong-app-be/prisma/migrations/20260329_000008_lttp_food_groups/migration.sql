-- Nhóm LTTP toàn cục (superadmin quản lý); mặt hàng gắn FK groupId.

CREATE TABLE `LttpFoodGroup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LttpFoodGroup_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `LttpFoodGroup` (`code`, `name`, `sortOrder`, `isActive`, `createdAt`, `updatedAt`)
VALUES ('other', 'Khác', 0, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

ALTER TABLE `LrtpCommodity` ADD COLUMN `groupId` INTEGER NULL;

UPDATE `LrtpCommodity` SET `groupId` = (SELECT `id` FROM `LttpFoodGroup` WHERE `code` = 'other' LIMIT 1);

ALTER TABLE `LrtpCommodity` MODIFY `groupId` INTEGER NOT NULL;

ALTER TABLE `LrtpCommodity` ADD CONSTRAINT `LrtpCommodity_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `LttpFoodGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `LrtpCommodity` DROP COLUMN `foodGroup`;
