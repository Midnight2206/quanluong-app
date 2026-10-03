CREATE TABLE `LttpAiLineNoteRule` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `kind` VARCHAR(64) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  UNIQUE INDEX `LttpAiLineNoteRule_kind_key`(`kind`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
