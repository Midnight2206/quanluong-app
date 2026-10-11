import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

function assertStoredPassword(passwordHash) {
  if (passwordHash == null || passwordHash === "") {
    throw new AppError({
      message: "Tên đăng nhập hoặc mật khẩu không đúng",
      statusCode: 401,
      code: ERROR_CODES.UNAUTHORIZED,
    });
  }
}

export { assertStoredPassword };
