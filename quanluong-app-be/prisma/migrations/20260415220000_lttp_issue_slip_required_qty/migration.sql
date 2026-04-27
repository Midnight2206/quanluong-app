-- Số lượng yêu cầu (dự kiến) tách với số lượng thực xuất (dùng tính thành tiền)
ALTER TABLE `LttpIssueSlipLine` ADD COLUMN `requiredQuantity` DECIMAL(18, 4) NULL;
