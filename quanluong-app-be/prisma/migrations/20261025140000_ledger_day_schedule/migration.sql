-- Lịch làm việc của một ngày sổ. Null với ngày đã có. Không đổi số liệu.
ALTER TABLE `KitchenLedgerDay` ADD COLUMN `scheduleJson` JSON NULL;
