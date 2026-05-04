-- Đồng bộ tên migration trên disk (20260330130000_...) với bản ghi cũ trong DB (20260330120100_...).
-- Chạy sau `migrate resolve --applied` khi cần; không xóa dữ liệu nghiệp vụ.
UPDATE `_prisma_migrations`
SET `migration_name` = '20260330130000_meal_roster_meal_allowance_rate_fk'
WHERE `migration_name` = '20260330120100_meal_roster_meal_allowance_rate_fk';
