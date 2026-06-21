-- Người mua hàng mặc định theo đơn vị kho + snapshot trên phiếu xuất
ALTER TABLE `LttpUnitIssueFormDefaults`
  ADD COLUMN `defaultBuyerUserId` INTEGER NULL;

CREATE INDEX `LttpUnitIssueFormDefaults_defaultBuyerUserId_idx`
  ON `LttpUnitIssueFormDefaults`(`defaultBuyerUserId`);

ALTER TABLE `LttpUnitIssueFormDefaults`
  ADD CONSTRAINT `LttpUnitIssueFormDefaults_defaultBuyerUserId_fkey`
  FOREIGN KEY (`defaultBuyerUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `LttpIssueSlip`
  ADD COLUMN `buyerUserId` INTEGER NULL,
  ADD COLUMN `buyerDisplayName` VARCHAR(191) NULL;

CREATE INDEX `LttpIssueSlip_buyerUserId_idx` ON `LttpIssueSlip`(`buyerUserId`);

ALTER TABLE `LttpIssueSlip`
  ADD CONSTRAINT `LttpIssueSlip_buyerUserId_fkey`
  FOREIGN KEY (`buyerUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
