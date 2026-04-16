export const successResponse = ({
  message = "Request completed successfully.",
  data = null,
  meta = null,
} = {}) => {
  const response = {
    success: true,
    message,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  return response;
};

export const errorResponse = ({
  message = "Request could not be completed.",
  code = "INTERNAL_SERVER_ERROR",
  details,
} = {}) => {
  const response = {
    success: false,
    message,
    error: {
      code,
    },
  };

  if (details) {
    response.error.details = details;
  }

  return response;
};
