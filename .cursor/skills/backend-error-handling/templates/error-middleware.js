import { AppError } from "./app-error";
import { errorResponse } from "../../backend-response-system/templates/response";

export const errorMiddleware = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    return res.status(error.status).json(
      errorResponse({
        code: error.code,
        message: error.message,
        details: error.details,
      }),
    );
  }

  return res.status(500).json(
    errorResponse({
      code: "INTERNAL_SERVER_ERROR",
      message: "Request could not be completed.",
    }),
  );
};
