-- AlterTable Profile: split rank into rankFull + rankAbbr, add department
ALTER TABLE `Profile`
    ADD COLUMN `rankFull` VARCHAR(128) NULL,
    ADD COLUMN `rankAbbr` VARCHAR(32) NULL,
    ADD COLUMN `department` VARCHAR(255) NULL;

-- Copy existing rank data to rankFull
UPDATE `Profile` SET `rankFull` = `rank` WHERE `rank` IS NOT NULL;

-- Drop old rank column
ALTER TABLE `Profile` DROP COLUMN `rank`;
