-- LTTP AI: thống kê thói quen, không sửa bảng phiếu cũ.

CREATE TABLE `LttpAiCommodityHabit` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `recipientUnitId` INTEGER NOT NULL,
  `commodityId` INTEGER NOT NULL,
  `measureUnit` VARCHAR(64) NOT NULL,
  `orderCount` INTEGER NOT NULL DEFAULT 0,
  `lastOrderedAt` DATETIME(3) NULL,
  `qtySamples` JSON NOT NULL,
  UNIQUE INDEX `LttpAiCommodityHabit_recipientUnitId_commodityId_measureUnit_key`(`recipientUnitId`, `commodityId`, `measureUnit`),
  INDEX `LttpAiCommodityHabit_recipientUnitId_idx`(`recipientUnitId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LttpAiAliasStat` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `recipientUnitId` INTEGER NOT NULL,
  `rawNorm` VARCHAR(191) NOT NULL,
  `commodityId` INTEGER NOT NULL,
  `hitCount` INTEGER NOT NULL DEFAULT 0,
  UNIQUE INDEX `LttpAiAliasStat_recipientUnitId_rawNorm_commodityId_key`(`recipientUnitId`, `rawNorm`, `commodityId`),
  INDEX `LttpAiAliasStat_recipientUnitId_rawNorm_idx`(`recipientUnitId`, `rawNorm`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LttpAiUomRule` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `recipientUnitId` INTEGER NOT NULL,
  `commodityId` INTEGER NULL,
  `fromUom` VARCHAR(64) NOT NULL,
  `factor` DECIMAL(18, 4) NOT NULL,
  `confirmed` BOOLEAN NOT NULL DEFAULT false,
  INDEX `LttpAiUomRule_recipientUnitId_fromUom_idx`(`recipientUnitId`, `fromUom`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LttpAiOrderMessage` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `recipientUserId` INTEGER NULL,
  `recipientUnitId` INTEGER NOT NULL,
  `storageUnitId` INTEGER NOT NULL,
  `rawText` TEXT NOT NULL,
  `parseResult` JSON NOT NULL,
  `issueSlipId` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `LttpAiOrderMessage_recipientUserId_createdAt_idx`(`recipientUserId`, `createdAt`),
  INDEX `LttpAiOrderMessage_issueSlipId_idx`(`issueSlipId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LttpAiFillLog` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `recipientUnitId` INTEGER NOT NULL,
  `recipientUserId` INTEGER NULL,
  `issueSlipId` INTEGER NULL,
  `aiJson` JSON NOT NULL,
  `confirmedJson` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `LttpAiFillLog_recipientUnitId_createdAt_idx`(`recipientUnitId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LttpAiCommodityHabit`
  ADD CONSTRAINT `LttpAiCommodityHabit_recipientUnitId_fkey` FOREIGN KEY (`recipientUnitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `LttpAiCommodityHabit_commodityId_fkey` FOREIGN KEY (`commodityId`) REFERENCES `LrtpCommodity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `LttpAiAliasStat`
  ADD CONSTRAINT `LttpAiAliasStat_recipientUnitId_fkey` FOREIGN KEY (`recipientUnitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `LttpAiUomRule`
  ADD CONSTRAINT `LttpAiUomRule_recipientUnitId_fkey` FOREIGN KEY (`recipientUnitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `LttpAiUomRule_commodityId_fkey` FOREIGN KEY (`commodityId`) REFERENCES `LrtpCommodity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `LttpAiOrderMessage`
  ADD CONSTRAINT `LttpAiOrderMessage_recipientUserId_fkey` FOREIGN KEY (`recipientUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `LttpAiOrderMessage_recipientUnitId_fkey` FOREIGN KEY (`recipientUnitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `LttpAiOrderMessage_issueSlipId_fkey` FOREIGN KEY (`issueSlipId`) REFERENCES `LttpIssueSlip`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
