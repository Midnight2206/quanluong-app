-- Persist print settings configured from LTTP Issue Slip FE.
ALTER TABLE `LttpUnitIssueFormDefaults`
  ADD COLUMN `marginTopCm` DECIMAL(5,2) NULL,
  ADD COLUMN `marginRightCm` DECIMAL(5,2) NULL,
  ADD COLUMN `marginBottomCm` DECIMAL(5,2) NULL,
  ADD COLUMN `marginLeftCm` DECIMAL(5,2) NULL,
  ADD COLUMN `printFontId` VARCHAR(32) NULL,
  ADD COLUMN `printFontSizePt` DECIMAL(5,2) NULL;
