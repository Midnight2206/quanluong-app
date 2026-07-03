-- Loại giá dòng phiếu xuất: mua thị trường (mặc định) hoặc TGSX.
ALTER TABLE `LttpIssueSlipLine`
  ADD COLUMN `priceKind` ENUM('market', 'tgsx') NOT NULL DEFAULT 'market';

UPDATE `LttpIssueSlipLine` SET `priceKind` = 'market' WHERE `priceKind` IS NULL;
