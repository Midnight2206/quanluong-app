-- Thứ tự nhóm LTTP trên sổ nhập xuất. Sửa sortOrder tại đây (hoặc trên màn nhóm hàng)
-- khi cần đổi thứ tự, không sửa code.
-- Mã không có trong danh sách giữ sortOrder cũ. Mã lạ sortOrder = 0 được xếp ngay trước chat_dot.

UPDATE `LttpFoodGroup` SET `sortOrder` = 10, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `code` = 'gao';
UPDATE `LttpFoodGroup` SET `sortOrder` = 20, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `code` = 'thit_nac';
UPDATE `LttpFoodGroup` SET `sortOrder` = 30, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `code` = 'thit_xo_loc';
UPDATE `LttpFoodGroup` SET `sortOrder` = 40, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `code` = 'bo';
UPDATE `LttpFoodGroup` SET `sortOrder` = 50, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `code` = 'gia_cam';
UPDATE `LttpFoodGroup` SET `sortOrder` = 60, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `code` = 'ca';
UPDATE `LttpFoodGroup` SET `sortOrder` = 70, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `code` = 'trung';
UPDATE `LttpFoodGroup` SET `sortOrder` = 80, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `code` = 'dau_phu';
UPDATE `LttpFoodGroup` SET `sortOrder` = 90, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `code` = 'vung_lac';
UPDATE `LttpFoodGroup` SET `sortOrder` = 100, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `code` = 'rau';
UPDATE `LttpFoodGroup` SET `sortOrder` = 110, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `code` = 'hoa_qua';
UPDATE `LttpFoodGroup` SET `sortOrder` = 120, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `code` = 'sua';
UPDATE `LttpFoodGroup` SET `sortOrder` = 130, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `code` = 'nuoc_mam';
UPDATE `LttpFoodGroup` SET `sortOrder` = 140, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `code` = 'muoi';
UPDATE `LttpFoodGroup` SET `sortOrder` = 150, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `code` = 'mi_chinh';
UPDATE `LttpFoodGroup` SET `sortOrder` = 160, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `code` = 'dau_mo';
UPDATE `LttpFoodGroup` SET `sortOrder` = 170, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `code` = 'gia_vi';
UPDATE `LttpFoodGroup` SET `sortOrder` = 180, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `code` = 'other';
UPDATE `LttpFoodGroup` SET `sortOrder` = 200, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `code` = 'chat_dot';
UPDATE `LttpFoodGroup` SET `sortOrder` = 210, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `code` = 've_sinh';
