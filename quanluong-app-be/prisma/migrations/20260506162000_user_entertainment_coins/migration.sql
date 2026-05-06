-- Add persistent entertainment coin balance for authenticated users.
ALTER TABLE `User`
ADD COLUMN `entertainmentCoins` INTEGER NOT NULL DEFAULT 1000;
