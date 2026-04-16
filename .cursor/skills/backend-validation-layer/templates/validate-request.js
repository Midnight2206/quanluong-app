import { mapZodError } from "./map-zod-error";

export const validateRequest =
  ({ bodySchema, querySchema, paramsSchema }) =>
  (req, _res, next) => {
    try {
      if (bodySchema) {
        req.validatedBody = bodySchema.parse(req.body);
      }

      if (querySchema) {
        req.validatedQuery = querySchema.parse(req.query);
      }

      if (paramsSchema) {
        req.validatedParams = paramsSchema.parse(req.params);
      }

      return next();
    } catch (error) {
      if (error?.name === "ZodError") {
        return next(mapZodError(error));
      }

      return next(error);
    }
  };
