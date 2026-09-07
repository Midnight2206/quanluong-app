-- CreateTable
CREATE TABLE `ChungTuBkmhHeaderSettings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `categoryKey` VARCHAR(80) NOT NULL,
    `hoTenNguoiMua` VARCHAR(191) NULL,
    `boPhan` VARCHAR(255) NULL,
    `updatedById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChungTuBkmhHeaderSettings_categoryKey_key`(`categoryKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ChungTuBkmhHeaderSettings` ADD CONSTRAINT `ChungTuBkmhHeaderSettings_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
