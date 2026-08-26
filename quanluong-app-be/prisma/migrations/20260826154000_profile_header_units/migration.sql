-- Store per-user chứng từ header unit fields on Profile.
ALTER TABLE `Profile`
  ADD COLUMN `donViCapTren` VARCHAR(255) NULL,
  ADD COLUMN `donVi` VARCHAR(255) NULL;
