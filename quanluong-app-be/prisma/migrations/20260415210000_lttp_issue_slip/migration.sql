-- Phiếu xuất LTTP theo ngày (snapshot giá tại thời điểm tạo)
CREATE TABLE `LttpIssueSlip` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unitId` INTEGER NOT NULL,
    `issueDate` DATE NOT NULL,
    `note` VARCHAR(500) NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`),
    INDEX `LttpIssueSlip_unitId_issueDate_idx`(`unitId`, `issueDate`),
    INDEX `LttpIssueSlip_createdById_idx`(`createdById`),
    CONSTRAINT `LttpIssueSlip_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `LttpIssueSlip_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4;

CREATE TABLE `LttpIssueSlipLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slipId` INTEGER NOT NULL,
    `commodityId` INTEGER NOT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `unitPrice` DECIMAL(18, 2) NOT NULL,
    `tgsxPrice` DECIMAL(18, 2) NULL,
    `amount` DECIMAL(18, 2) NOT NULL,

    PRIMARY KEY (`id`),
    INDEX `LttpIssueSlipLine_slipId_idx`(`slipId`),
    INDEX `LttpIssueSlipLine_commodityId_idx`(`commodityId`),
    CONSTRAINT `LttpIssueSlipLine_slipId_fkey` FOREIGN KEY (`slipId`) REFERENCES `LttpIssueSlip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `LttpIssueSlipLine_commodityId_fkey` FOREIGN KEY (`commodityId`) REFERENCES `LrtpCommodity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4;
