export class AppError extends Error {
  constructor({ code, message, status = 500, details } = {}) {
    super(message);
    this.name = "AppError";
    this.code = code ?? "APP_ERROR";
    this.status = status;
    this.details = details;
  }
}
