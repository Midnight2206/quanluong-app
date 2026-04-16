-- Hoàn tác backfill tự động: chỉ những bản ghi được set emailVerifiedAt = createdAt (như migration 20260328150000).
-- Bỏ qua superadmin. User đã xác minh qua link thường có emailVerifiedAt khác createdAt.
UPDATE `User` u
INNER JOIN `Type` t ON u.`typeId` = t.`id`
SET u.`emailVerifiedAt` = NULL
WHERE t.`name` <> 'superadmin'
  AND u.`deletedAt` IS NULL
  AND u.`emailVerifiedAt` IS NOT NULL
  AND u.`emailVerifiedAt` = u.`createdAt`;
