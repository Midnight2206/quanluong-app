-- Idempotent: đảm bảo mọi phiếu & default người mua đều NULL trước khi admin cấu hình qua UI.
UPDATE `LttpIssueSlip`
SET `buyerUserId` = NULL, `buyerDisplayName` = NULL
WHERE `buyerUserId` IS NOT NULL OR `buyerDisplayName` IS NOT NULL;

UPDATE `LttpUnitIssueFormDefaults`
SET `defaultBuyerUserId` = NULL
WHERE `defaultBuyerUserId` IS NOT NULL;
