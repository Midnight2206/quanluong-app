-- Remove entertainment coin game columns (feature removed).
ALTER TABLE `User`
  DROP COLUMN `entertainmentCoins`,
  DROP COLUMN `entertainmentHeadsCount`,
  DROP COLUMN `entertainmentTailsCount`;
