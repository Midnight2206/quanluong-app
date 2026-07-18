-- lineSource: on_guarantee | unit_self (MySQL inline ENUM)
ALTER TABLE `KitchenReceiptSlipLine`
  ADD COLUMN `lineSource` ENUM('on_guarantee', 'unit_self') NOT NULL DEFAULT 'unit_self';

-- Merge duplicate slips per (unitId, receiptDate): keep lowest id
CREATE TEMPORARY TABLE `_krs_keepers` AS
SELECT MIN(`id`) AS `keeperId`, `unitId`, `receiptDate`
FROM `KitchenReceiptSlip`
GROUP BY `unitId`, `receiptDate`
HAVING COUNT(*) > 1;

UPDATE `KitchenReceiptSlipLine` `ln`
INNER JOIN `KitchenReceiptSlip` `s` ON `ln`.`slipId` = `s`.`id`
INNER JOIN `_krs_keepers` `k`
  ON `s`.`unitId` = `k`.`unitId` AND `s`.`receiptDate` = `k`.`receiptDate`
SET `ln`.`slipId` = `k`.`keeperId`
WHERE `s`.`id` <> `k`.`keeperId`;

DELETE `s` FROM `KitchenReceiptSlip` `s`
INNER JOIN `_krs_keepers` `k`
  ON `s`.`unitId` = `k`.`unitId` AND `s`.`receiptDate` = `k`.`receiptDate`
WHERE `s`.`id` <> `k`.`keeperId`;

DROP TEMPORARY TABLE `_krs_keepers`;

DROP INDEX `KitchenReceiptSlip_unitId_receiptDate_idx` ON `KitchenReceiptSlip`;

CREATE UNIQUE INDEX `KitchenReceiptSlip_unitId_receiptDate_key`
  ON `KitchenReceiptSlip`(`unitId`, `receiptDate`);

CREATE INDEX `KitchenReceiptSlipLine_slipId_lineSource_priceKind_idx`
  ON `KitchenReceiptSlipLine`(`slipId`, `lineSource`, `priceKind`);
