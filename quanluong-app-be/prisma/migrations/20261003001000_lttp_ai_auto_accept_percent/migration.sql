-- Ngưỡng điểm để AI tự chốt mã, theo đơn vị kho.

ALTER TABLE `LttpUnitIssueFormDefaults`
  ADD COLUMN `aiAutoAcceptPercent` INTEGER NULL;
