-- Địa chỉ theo đơn vị nhận (tab Nhập xuất LTTP → Cài người nhận theo đơn vị nhận).
ALTER TABLE `LttpRecipientUnitDefaultUser`
  ADD COLUMN `address` VARCHAR(500) NULL;
