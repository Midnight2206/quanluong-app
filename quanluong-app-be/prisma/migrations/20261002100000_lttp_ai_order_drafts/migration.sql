-- Bản nháp AI phiếu xuất. Không sửa bảng phiếu cũ.

CREATE TABLE `LttpAiOrderDraft` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `storageUnitId` INTEGER NOT NULL,
  `recipientUnitId` INTEGER NOT NULL,
  `recipientUserId` INTEGER NULL,
  `orderMessageId` INTEGER NULL,
  `issueSlipId` INTEGER NULL,
  `rawText` TEXT NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'editing',
  `version` INTEGER NOT NULL DEFAULT 1,
  `createdById` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `LttpAiOrderDraft_recipientUserId_recipientUnitId_status_idx`(`recipientUserId`, `recipientUnitId`, `status`),
  INDEX `LttpAiOrderDraft_storageUnitId_status_updatedAt_idx`(`storageUnitId`, `status`, `updatedAt`),
  INDEX `LttpAiOrderDraft_issueSlipId_idx`(`issueSlipId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LttpAiDraftLine` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `draftId` INTEGER NOT NULL,
  `sortOrder` INTEGER NOT NULL,
  `commodityId` INTEGER NULL,
  `commodityName` VARCHAR(255) NULL,
  `code` VARCHAR(64) NULL,
  `quantity` DECIMAL(18, 4) NULL,
  `measureUnit` VARCHAR(64) NULL,
  `status` VARCHAR(16) NOT NULL,
  `decisionSource` VARCHAR(16) NOT NULL,
  `confidence` DECIMAL(6, 4) NOT NULL DEFAULT 0,
  `rawName` VARCHAR(255) NOT NULL DEFAULT '',
  `writtenQty` VARCHAR(64) NULL,
  `writtenUom` VARCHAR(64) NULL,
  `choices` JSON NOT NULL,
  `lttpSupplierId` INTEGER NULL,
  `unitPrice` DECIMAL(18, 4) NULL,
  `priceKind` VARCHAR(16) NOT NULL DEFAULT 'market',
  INDEX `LttpAiDraftLine_draftId_sortOrder_idx`(`draftId`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LttpAiDraftLineEvent` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `draftLineId` INTEGER NOT NULL,
  `source` VARCHAR(16) NOT NULL,
  `beforeJson` JSON NULL,
  `afterJson` JSON NOT NULL,
  `actorUserId` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `LttpAiDraftLineEvent_draftLineId_createdAt_idx`(`draftLineId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LttpAiDraftChatTurn` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `draftId` INTEGER NOT NULL,
  `role` VARCHAR(16) NOT NULL,
  `content` TEXT NOT NULL,
  `tickedLineIds` JSON NOT NULL,
  `proposedPatch` JSON NULL,
  `applied` BOOLEAN NOT NULL DEFAULT false,
  `actorUserId` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `LttpAiDraftChatTurn_draftId_createdAt_idx`(`draftId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LttpAiOrderDraft`
  ADD CONSTRAINT `LttpAiOrderDraft_storageUnitId_fkey` FOREIGN KEY (`storageUnitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `LttpAiOrderDraft_recipientUnitId_fkey` FOREIGN KEY (`recipientUnitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `LttpAiOrderDraft_recipientUserId_fkey` FOREIGN KEY (`recipientUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `LttpAiOrderDraft_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `LttpAiOrderDraft_orderMessageId_fkey` FOREIGN KEY (`orderMessageId`) REFERENCES `LttpAiOrderMessage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `LttpAiOrderDraft_issueSlipId_fkey` FOREIGN KEY (`issueSlipId`) REFERENCES `LttpIssueSlip`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `LttpAiDraftLine`
  ADD CONSTRAINT `LttpAiDraftLine_draftId_fkey` FOREIGN KEY (`draftId`) REFERENCES `LttpAiOrderDraft`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `LttpAiDraftLine_commodityId_fkey` FOREIGN KEY (`commodityId`) REFERENCES `LrtpCommodity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `LttpAiDraftLineEvent`
  ADD CONSTRAINT `LttpAiDraftLineEvent_draftLineId_fkey` FOREIGN KEY (`draftLineId`) REFERENCES `LttpAiDraftLine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `LttpAiDraftChatTurn`
  ADD CONSTRAINT `LttpAiDraftChatTurn_draftId_fkey` FOREIGN KEY (`draftId`) REFERENCES `LttpAiOrderDraft`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
