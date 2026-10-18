-- AlterEnum
ALTER TABLE `BaApiToken` MODIFY `scope` ENUM('UNIT_PUSH', 'GLOBAL_READ', 'GLOBAL_WRITE') NOT NULL;

-- AlterTable
ALTER TABLE `BaUnitProfile` ADD COLUMN `rules` JSON NULL,
  ADD COLUMN `baselineVersion` INTEGER NULL;

-- CreateTable
CREATE TABLE `BaBaselineDoc` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `docKey` VARCHAR(40) NOT NULL,
  `version` INTEGER NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `contentMarkdown` LONGTEXT NOT NULL,
  `ruleIds` JSON NULL,
  `publishedBy` VARCHAR(64) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `BaBaselineDoc_docKey_version_key`(`docKey`, `version`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BaProposal` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `unitId` INTEGER NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `relatedRuleIds` JSON NULL,
  `proposedText` TEXT NOT NULL,
  `status` ENUM('OPEN', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'OPEN',
  `reviewComment` TEXT NULL,
  `reviewedBy` VARCHAR(64) NULL,
  `reviewedAt` DATETIME(3) NULL,
  `createdByTokenId` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `BaProposal_unitId_idx`(`unitId`),
  INDEX `BaProposal_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BaProposal`
  ADD CONSTRAINT `BaProposal_unitId_fkey`
    FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
