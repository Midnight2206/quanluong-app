import { AppError } from "../templates/app-error";

export const requireEntity = (entity, code = "RESOURCE_NOT_FOUND") => {
  if (!entity) {
    throw new AppError({
      code,
      message: "Resource not found.",
      status: 404,
    });
  }

  return entity;
};
