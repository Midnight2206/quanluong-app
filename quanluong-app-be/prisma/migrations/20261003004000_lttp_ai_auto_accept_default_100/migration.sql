-- Mọi kho cấp 1 bắt đầu ở 100%: điểm phải cao hơn mức này thì AI mới tự chốt mã.

ALTER TABLE `LttpUnitIssueFormDefaults`
  MODIFY `aiAutoAcceptPercent` INTEGER NULL DEFAULT 100;

UPDATE `LttpUnitIssueFormDefaults`
  SET `aiAutoAcceptPercent` = 100
  WHERE `aiAutoAcceptPercent` IS NULL;
