-- LTTP phiếu xuất: receivedDate, signerStorekeeper, per-unit signature settings

ALTER TABLE `LttpIssueSlip`
  ADD COLUMN `receivedDate` DATE NULL AFTER `issueDate`,
  ADD COLUMN `signerStorekeeper` VARCHAR(191) NULL AFTER `signerWriter`;

CREATE TABLE `LttpIssueSlipSignatureSettings` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `unitId` INTEGER NOT NULL,
  `signatureBlockJson` JSON NOT NULL,
  `extraFieldsJson` JSON NULL,
  `updatedById` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `LttpIssueSlipSignatureSettings_unitId_key`(`unitId`),
  INDEX `LttpIssueSlipSignatureSettings_updatedById_idx`(`updatedById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LttpIssueSlipSignatureSettings`
  ADD CONSTRAINT `LttpIssueSlipSignatureSettings_unitId_fkey`
    FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `LttpIssueSlipSignatureSettings_updatedById_fkey`
    FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
