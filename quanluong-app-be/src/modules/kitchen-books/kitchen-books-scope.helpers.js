import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { assertUnitIdInScope } from "../../shared/units/unit-scope.service.js";

/** Đối chiếu `unitId` từ query/body với `req.dataScope` từ middleware. */
function assertKitchenLogicalMatchesDataScope(unitId, dataScope) {
  if (!dataScope || dataScope.storageUnitId == null) {
    throw new AppError({
      message: "Thiếu phạm vi dữ liệu LTTP",
      statusCode: 500,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  if (Number(unitId) !== Number(dataScope.logicalUnitId)) {
    throw new AppError({
      message: "unitId không khớp ngữ cảnh phạm vi dữ liệu",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

function assertKitchenRowStorage(rowUnitId, dataScope) {
  if (rowUnitId !== dataScope.storageUnitId) {
    throw new AppError({
      message: "Không tìm thấy dữ liệu",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
}

/** Phiếu nhập kho gắn logicalUnitId (đơn vị làm việc / đơn vị nhận), không phải kho LTTP chung. */
function assertKitchenRowLogical(rowUnitId, dataScope) {
  if (Number(rowUnitId) !== Number(dataScope.logicalUnitId)) {
    throw new AppError({
      message: "Không tìm thấy dữ liệu",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
}

function assertKitchenWriteUnit(unitId, scope, effectiveUnitIds) {
  assertUnitIdInScope(unitId, scope);
  if (
    effectiveUnitIds != null &&
    effectiveUnitIds.length > 0 &&
    !effectiveUnitIds.includes(Number(unitId))
  ) {
    throw new AppError({
      message: "Đơn vị ngoài nhánh đang chọn (kiểm tra X-Target-Unit-Id).",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }
}

function parseDateOnly(input) {
  if (input == null || input === "") {
    throw new AppError({
      message: "Ngày không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if (input instanceof Date) {
    return input;
  }
  const s = String(input).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    throw new AppError({
      message: "Ngày phải dạng YYYY-MM-DD",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d));
}

function menuDateToYearMonthDay(menuDate) {
  const d = parseDateOnly(menuDate);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = d.getUTCDate();
  return { yearMonth: `${y}-${mo}`, dayOfMonth: day };
}

export {
  assertKitchenLogicalMatchesDataScope,
  assertKitchenRowStorage,
  assertKitchenRowLogical,
  assertKitchenWriteUnit,
  parseDateOnly,
  menuDateToYearMonthDay,
};
