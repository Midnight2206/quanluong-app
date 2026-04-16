-- Mọi tài khoản trừ superadmin: coi như chưa xác minh email.
UPDATE `User` u
INNER JOIN `Type` t ON u.`typeId` = t.`id`
SET
  u.`emailVerifiedAt` = NULL,
  u.`emailVerificationTokenHash` = NULL,
  u.`emailVerificationExpiresAt` = NULL
WHERE t.`name` <> 'superadmin'
  AND u.`deletedAt` IS NULL;
