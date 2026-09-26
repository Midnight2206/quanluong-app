-- LTTP phiếu xuất: AI session memory (chat + preview before/after apply)

CREATE TABLE `LttpIssueSlipAiMemory` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `unitId` INTEGER NOT NULL,
  `sessionId` CHAR(36) NOT NULL,
  `prompt` VARCHAR(2000) NOT NULL,
  `turns` JSON NOT NULL,
  `finalPreview` JSON NULL,
  `issueSlipId` INTEGER NULL,
  `createdById` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `LttpIssueSlipAiMemory_sessionId_key`(`sessionId`),
  INDEX `LttpIssueSlipAiMemory_unitId_updatedAt_idx`(`unitId`, `updatedAt`),
  INDEX `LttpIssueSlipAiMemory_issueSlipId_idx`(`issueSlipId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LttpIssueSlipAiMemory`
  ADD CONSTRAINT `LttpIssueSlipAiMemory_unitId_fkey`
    FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `LttpIssueSlipAiMemory_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `LttpIssueSlipAiMemory_issueSlipId_fkey`
    FOREIGN KEY (`issueSlipId`) REFERENCES `LttpIssueSlip`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
