ALTER TABLE `ChungTuPdfTemplate`
  ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'draft';

UPDATE `ChungTuPdfTemplate`
SET `status` = IF(`isActive` = true, 'published', 'retired');

DROP INDEX `ChungTuPdfTemplate_categoryKey_isActive_idx` ON `ChungTuPdfTemplate`;

ALTER TABLE `ChungTuPdfTemplate`
  DROP COLUMN `isActive`;

CREATE INDEX `ChungTuPdfTemplate_categoryKey_status_idx`
  ON `ChungTuPdfTemplate`(`categoryKey`, `status`);
