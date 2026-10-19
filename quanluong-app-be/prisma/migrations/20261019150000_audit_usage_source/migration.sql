-- AlterTable
ALTER TABLE `UsageEvent` ADD COLUMN `source` VARCHAR(16) NOT NULL DEFAULT 'web';

-- AlterTable
ALTER TABLE `UsageSessionDaily` DROP PRIMARY KEY,
    ADD COLUMN `source` VARCHAR(16) NOT NULL DEFAULT 'web',
    ADD PRIMARY KEY (`userId`, `day`, `source`);

