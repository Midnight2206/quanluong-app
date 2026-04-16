-- Email verification + Google Drive root folder (midnight-app)
ALTER TABLE `User` ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL,
ADD COLUMN `emailVerificationTokenHash` VARCHAR(64) NULL,
ADD COLUMN `emailVerificationExpiresAt` DATETIME(3) NULL,
ADD COLUMN `googleRefreshToken` TEXT NULL,
ADD COLUMN `googleDriveFolderId` VARCHAR(128) NULL;

CREATE UNIQUE INDEX `User_emailVerificationTokenHash_key` ON `User`(`emailVerificationTokenHash`);

-- Tài khoản hiện có coi như đã xác minh email
UPDATE `User` SET `emailVerifiedAt` = COALESCE(`emailVerifiedAt`, `createdAt`) WHERE `emailVerifiedAt` IS NULL;
