-- Ảnh chữ ký PNG theo hồ sơ user (ký số dạng ảnh trên PDF)
ALTER TABLE `Profile` ADD COLUMN `signatureUrl` VARCHAR(191) NULL;
