ALTER TABLE `LttpUnitIssueFormDefaults` ADD COLUMN `defaultRecipientUserId` INTEGER NULL;
CREATE INDEX `LttpUnitIssueFormDefaults_defaultRecipientUserId_idx` ON `LttpUnitIssueFormDefaults`(`defaultRecipientUserId`);
ALTER TABLE `LttpUnitIssueFormDefaults`
  ADD CONSTRAINT `LttpUnitIssueFormDefaults_defaultRecipientUserId_fkey` FOREIGN KEY (`defaultRecipientUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
