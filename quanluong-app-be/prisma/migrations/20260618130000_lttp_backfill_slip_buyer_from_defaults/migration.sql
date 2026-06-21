-- Reset người mua hàng: phiếu xuất cũ và cấu hình mặc định đều NULL.
-- Admin chọn user trên UI tab Nhập xuất LTTP → lưu & áp dụng toàn bộ phiếu theo đơn vị kho.

UPDATE `LttpIssueSlip`
SET
  `buyerUserId` = NULL,
  `buyerDisplayName` = NULL;

UPDATE `LttpUnitIssueFormDefaults`
SET `defaultBuyerUserId` = NULL;
