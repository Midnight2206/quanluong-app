-- Người nhận mặc định theo đơn vị nhận (riêng với cấu hình mẫu in theo kho cấp).
CREATE TABLE `LttpRecipientUnitDefaultUser` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `recipientUnitId` INT NOT NULL,
  `defaultUserId` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `LttpRecipientUnitDefaultUser_recipientUnitId_key`(`recipientUnitId`),
  INDEX `LttpRecipientUnitDefaultUser_defaultUserId_idx`(`defaultUserId`),
  CONSTRAINT `LttpRecipientUnitDefaultUser_recipientUnitId_fkey` FOREIGN KEY (`recipientUnitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `LttpRecipientUnitDefaultUser_defaultUserId_fkey` FOREIGN KEY (`defaultUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
