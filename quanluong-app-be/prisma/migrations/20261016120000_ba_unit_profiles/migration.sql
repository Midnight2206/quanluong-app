-- CreateTable
CREATE TABLE `BaApiToken` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `tokenHash` VARCHAR(64) NOT NULL,
  `prefix` VARCHAR(24) NOT NULL,
  `scope` ENUM('UNIT_PUSH', 'GLOBAL_READ') NOT NULL,
  `unitId` INTEGER NULL,
  `createdByUserId` INTEGER NULL,
  `lastUsedAt` DATETIME(3) NULL,
  `revokedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `BaApiToken_tokenHash_key`(`tokenHash`),
  INDEX `BaApiToken_unitId_idx`(`unitId`),
  INDEX `BaApiToken_createdByUserId_idx`(`createdByUserId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BaUnitProfile` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `unitId` INTEGER NOT NULL,
  `version` INTEGER NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `contentMarkdown` LONGTEXT NOT NULL,
  `schemaVersion` VARCHAR(32) NOT NULL,
  `sourceAgentName` VARCHAR(120) NULL,
  `pushedByTokenId` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `BaUnitProfile_unitId_version_key`(`unitId`, `version`),
  INDEX `BaUnitProfile_pushedByTokenId_idx`(`pushedByTokenId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BaApiToken`
  ADD CONSTRAINT `BaApiToken_unitId_fkey`
    FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `BaApiToken_createdByUserId_fkey`
    FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `BaUnitProfile`
  ADD CONSTRAINT `BaUnitProfile_unitId_fkey`
    FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `BaUnitProfile_pushedByTokenId_fkey`
    FOREIGN KEY (`pushedByTokenId`) REFERENCES `BaApiToken`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
