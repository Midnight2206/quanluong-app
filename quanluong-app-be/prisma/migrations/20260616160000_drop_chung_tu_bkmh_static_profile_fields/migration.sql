-- BKMH: Google Sheets tự xử lý họ tên người mua và mẫu số bằng công thức,
-- nên không lưu/sync hai trường này từ app nữa.

-- Xóa mapping named range cũ theo fieldKey khỏi cấu hình mapping theo template.
UPDATE `ChungTuTemplateFillConfig` AS c
SET c.`fillRulesJson` = JSON_SET(
  c.`fillRulesJson`,
  '$.sheets.namedRanges',
  COALESCE(
    (
      SELECT JSON_ARRAYAGG(JSON_EXTRACT(j.item, '$') ORDER BY j.ord)
      FROM JSON_TABLE(
        c.`fillRulesJson`,
        '$.sheets.namedRanges[*]'
        COLUMNS (
          ord FOR ORDINALITY,
          item JSON PATH '$',
          fieldKey VARCHAR(191) PATH '$.fieldKey' NULL ON EMPTY
        )
      ) AS j
      WHERE COALESCE(j.fieldKey, '') NOT IN ('hoTenNguoiMua', 'mauSo')
    ),
    JSON_ARRAY()
  )
)
WHERE c.`categoryKey` = 'bang-ke-mua-hang'
  AND JSON_CONTAINS_PATH(c.`fillRulesJson`, 'one', '$.sheets.namedRanges');

-- Xóa mapping named range cũ khỏi catalog template nếu superadmin lưu fillRules tại catalog.
UPDATE `ChungTuDriveTemplateLink` AS c
SET c.`fillRulesJson` = JSON_SET(
  c.`fillRulesJson`,
  '$.sheets.namedRanges',
  COALESCE(
    (
      SELECT JSON_ARRAYAGG(JSON_EXTRACT(j.item, '$') ORDER BY j.ord)
      FROM JSON_TABLE(
        c.`fillRulesJson`,
        '$.sheets.namedRanges[*]'
        COLUMNS (
          ord FOR ORDINALITY,
          item JSON PATH '$',
          fieldKey VARCHAR(191) PATH '$.fieldKey' NULL ON EMPTY
        )
      ) AS j
      WHERE COALESCE(j.fieldKey, '') NOT IN ('hoTenNguoiMua', 'mauSo')
    ),
    JSON_ARRAY()
  )
)
WHERE c.`categoryKey` = 'bang-ke-mua-hang'
  AND c.`fillRulesJson` IS NOT NULL
  AND JSON_CONTAINS_PATH(c.`fillRulesJson`, 'one', '$.sheets.namedRanges');

-- Xóa giá trị đã lưu trong settingsJson của các chứng từ BKMH cũ.
UPDATE `ChungTuDocument`
SET `settingsJson` = JSON_REMOVE(`settingsJson`, '$.hoTenNguoiMua', '$.mauSo')
WHERE `categoryKey` = 'bang-ke-mua-hang'
  AND JSON_CONTAINS_PATH(`settingsJson`, 'one', '$.hoTenNguoiMua', '$.mauSo');

-- Drop cột profile mặc định không còn dùng.
ALTER TABLE `ChungTuUnitProfile`
  DROP COLUMN `hoTenNguoiMua`,
  DROP COLUMN `mauSo`;
