-- AlterTable
ALTER TABLE `Unit` ADD COLUMN `parentId` INTEGER NULL;
ALTER TABLE `Unit` ADD COLUMN `path` VARCHAR(512) NOT NULL DEFAULT '';
ALTER TABLE `Unit` ADD COLUMN `depth` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `Unit_parentId_idx` ON `Unit`(`parentId`);
CREATE INDEX `Unit_path_idx` ON `Unit`(`path`);

-- AddForeignKey
ALTER TABLE `Unit` ADD CONSTRAINT `Unit_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Unit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill roots (no parent): materialized path
UPDATE `Unit`
SET `path` = CONCAT('/', `id`, '/'),
    `depth` = 0
WHERE `parentId` IS NULL;
