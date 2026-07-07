-- CreateTable
CREATE TABLE `KitchenDishCatalog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `name` VARCHAR(300) NOT NULL,
    `note` VARCHAR(500) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `KitchenDishCatalog_unitId_name_key`(`unitId`, `name`),
    INDEX `KitchenDishCatalog_unitId_idx`(`unitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KitchenDishCatalogLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `catalogId` INTEGER NOT NULL,
    `commodityId` INTEGER NOT NULL,
    `calcMode` ENUM('per_person', 'per_unit_shared') NOT NULL,
    `perPersonAmount` DECIMAL(18, 4) NULL,
    `perPersonUnit` ENUM('g', 'ml') NULL,
    `peoplePerUnit` DECIMAL(18, 4) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `KitchenDishCatalogLine_catalogId_idx`(`catalogId`),
    INDEX `KitchenDishCatalogLine_commodityId_idx`(`commodityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KitchenMenuDay` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `menuDate` DATE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `KitchenMenuDay_unitId_menuDate_key`(`unitId`, `menuDate`),
    INDEX `KitchenMenuDay_unitId_menuDate_idx`(`unitId`, `menuDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KitchenMenuPeriod` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dayId` INTEGER NOT NULL,
    `mealPeriod` ENUM('sang', 'trua', 'chieu') NOT NULL,
    `note` VARCHAR(500) NULL,

    UNIQUE INDEX `KitchenMenuPeriod_dayId_mealPeriod_key`(`dayId`, `mealPeriod`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KitchenMenuDish` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `periodId` INTEGER NOT NULL,
    `name` VARCHAR(300) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `sourceCatalogId` INTEGER NULL,

    INDEX `KitchenMenuDish_periodId_idx`(`periodId`),
    INDEX `KitchenMenuDish_sourceCatalogId_idx`(`sourceCatalogId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KitchenMenuDishLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dishId` INTEGER NOT NULL,
    `commodityId` INTEGER NOT NULL,
    `calcMode` ENUM('per_person', 'per_unit_shared') NOT NULL,
    `perPersonAmount` DECIMAL(18, 4) NULL,
    `perPersonUnit` ENUM('g', 'ml') NULL,
    `peoplePerUnit` DECIMAL(18, 4) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `KitchenMenuDishLine_dishId_idx`(`dishId`),
    INDEX `KitchenMenuDishLine_commodityId_idx`(`commodityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `KitchenDishCatalog` ADD CONSTRAINT `KitchenDishCatalog_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KitchenDishCatalogLine` ADD CONSTRAINT `KitchenDishCatalogLine_catalogId_fkey` FOREIGN KEY (`catalogId`) REFERENCES `KitchenDishCatalog`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KitchenDishCatalogLine` ADD CONSTRAINT `KitchenDishCatalogLine_commodityId_fkey` FOREIGN KEY (`commodityId`) REFERENCES `LrtpCommodity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KitchenMenuDay` ADD CONSTRAINT `KitchenMenuDay_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KitchenMenuPeriod` ADD CONSTRAINT `KitchenMenuPeriod_dayId_fkey` FOREIGN KEY (`dayId`) REFERENCES `KitchenMenuDay`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KitchenMenuDish` ADD CONSTRAINT `KitchenMenuDish_periodId_fkey` FOREIGN KEY (`periodId`) REFERENCES `KitchenMenuPeriod`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KitchenMenuDish` ADD CONSTRAINT `KitchenMenuDish_sourceCatalogId_fkey` FOREIGN KEY (`sourceCatalogId`) REFERENCES `KitchenDishCatalog`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KitchenMenuDishLine` ADD CONSTRAINT `KitchenMenuDishLine_dishId_fkey` FOREIGN KEY (`dishId`) REFERENCES `KitchenMenuDish`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KitchenMenuDishLine` ADD CONSTRAINT `KitchenMenuDishLine_commodityId_fkey` FOREIGN KEY (`commodityId`) REFERENCES `LrtpCommodity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
