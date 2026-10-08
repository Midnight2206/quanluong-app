CREATE TABLE `UserLttpSupplier` (
  `userId` INTEGER NOT NULL,
  `lttpSupplierId` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `UserLttpSupplier_lttpSupplierId_idx`(`lttpSupplierId`),
  PRIMARY KEY (`userId`, `lttpSupplierId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `UserLttpSupplier`
  ADD CONSTRAINT `UserLttpSupplier_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `UserLttpSupplier_lttpSupplierId_fkey`
    FOREIGN KEY (`lttpSupplierId`) REFERENCES `LttpSupplier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
