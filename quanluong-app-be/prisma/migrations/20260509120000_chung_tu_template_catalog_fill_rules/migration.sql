-- Quy tắc điền mẫu chứng từ (JSON v2) gắn với từng dòng danh mục Drive — superadmin cấu hình.
ALTER TABLE `ChungTuDriveTemplateLink` ADD COLUMN `fillRulesJson` JSON NULL;
