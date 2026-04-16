class AppError extends Error {
  constructor({
    message = "Request failed",
    statusCode = 500,
    code = "INTERNAL_SERVER_ERROR",
    details,
  } = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export { AppError };
