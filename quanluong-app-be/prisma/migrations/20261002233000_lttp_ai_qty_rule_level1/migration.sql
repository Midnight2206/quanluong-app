-- Quy ước số lượng từ chat, dùng chung cho kho cấp 1.

ALTER TABLE `LttpAiUomRule`
  ADD COLUMN `sharedLevel1` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `commodityNameNorm` VARCHAR(191) NULL,
  ADD INDEX `LttpAiUomRule_sharedLevel1_fromUom_idx`(`sharedLevel1`, `fromUom`);
