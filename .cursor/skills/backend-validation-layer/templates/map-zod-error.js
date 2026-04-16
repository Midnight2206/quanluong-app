import { AppError } from "../../backend-error-handling/templates/app-error";

export const mapZodError = (error) => {
  return new AppError({
    code: "VALIDATION_ERROR",
    message: "Invalid request data.",
    status: 400,
    details: error.issues?.map((issue) => ({
      path: issue.path,
      message: issue.message,
      code: issue.code,
    })),
  });
};
