-- Chia tiền theo buổi (S/T/C) cho từng mức đơn vị đã chọn
ALTER TABLE `UnitSelectedMealRate` ADD COLUMN `periodAmountsJson` JSON NULL;
