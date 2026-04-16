import { ZodError } from "zod";
import { AppError } from "../errors/app-error.js";
import { ERROR_CODES } from "../errors/error-codes.js";

function validateRequest({ body, query, params } = {}) {
  return (req, _res, next) => {
    try {
      if (body) {
        req.validatedBody = body.parse(req.body);
      }

      if (query) {
        req.validatedQuery = query.parse(req.query);
      }

      if (params) {
        req.validatedParams = params.parse(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(
          new AppError({
            message: "Invalid request data",
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            details: error.flatten(),
          }),
        );
      }

      return next(error);
    }
  };
}

export { validateRequest };
