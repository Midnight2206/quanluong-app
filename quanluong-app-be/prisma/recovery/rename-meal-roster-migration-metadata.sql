-- Khôi phục metadata meal_roster (20100 vs 30000) khi không thể `migrate resolve` cho tên 20100
-- (thư mục migration 20100 không còn trong repo).
--
-- Checksum = SHA-256 (hex) nội dung file:
--   prisma/migrations/20260330130000_meal_roster_meal_allowance_rate_fk/migration.sql
-- Nếu sửa file migration đó, chạy lại: node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('.../migration.sql')).digest('hex'))"
-- rồi cập nhật giá trị checksum dưới đây.

SET @checksum_30000 := '66eaa27aed954fbed151d01d844a2bbe41054054f5bf930c3eadd9f1900191b0';

-- Xóa bản ghi tên cũ nếu đã có bản ghi 30000 (tránh trùng tên sau khi đổi tên).
DELETE FROM `_prisma_migrations`
WHERE `migration_name` = '20260330120100_meal_roster_meal_allowance_rate_fk'
  AND EXISTS (
    SELECT 1 FROM `_prisma_migrations` AS t
    WHERE t.`migration_name` = '20260330130000_meal_roster_meal_allowance_rate_fk'
  );

-- Còn mỗi bản ghi 20100: đổi tên sang 30000 + trạng thái đã apply + checksum khớp file trên disk.
UPDATE `_prisma_migrations`
SET
  `migration_name` = '20260330130000_meal_roster_meal_allowance_rate_fk',
  `checksum` = @checksum_30000,
  `finished_at` = COALESCE(`finished_at`, CURRENT_TIMESTAMP(3)),
  `logs` = NULL,
  `rolled_back_at` = NULL,
  `applied_steps_count` = GREATEST(COALESCE(`applied_steps_count`, 0), 1)
WHERE `migration_name` = '20260330120100_meal_roster_meal_allowance_rate_fk';

-- Bản ghi 30000 bị kẹt failed (DDL đã chạy một phần / duplicate column): đánh dấu thành công, không chạy lại file.
UPDATE `_prisma_migrations`
SET
  `checksum` = @checksum_30000,
  `finished_at` = COALESCE(`finished_at`, CURRENT_TIMESTAMP(3)),
  `logs` = NULL,
  `rolled_back_at` = NULL,
  `applied_steps_count` = GREATEST(COALESCE(`applied_steps_count`, 0), 1)
WHERE `migration_name` = '20260330130000_meal_roster_meal_allowance_rate_fk'
  AND (`finished_at` IS NULL OR `logs` IS NOT NULL);
