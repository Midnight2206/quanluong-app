-- Track only aggregate coin flip counts (no detailed history).
ALTER TABLE `User`
ADD COLUMN `entertainmentHeadsCount` INTEGER NOT NULL DEFAULT 0,
ADD COLUMN `entertainmentTailsCount` INTEGER NOT NULL DEFAULT 0;
