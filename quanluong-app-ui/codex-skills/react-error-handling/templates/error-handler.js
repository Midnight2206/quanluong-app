export const normalizeError = (error) => {
  if (!error) {
    return {
      code: "UNKNOWN_ERROR",
      message: "Something went wrong.",
      severity: "error",
    };
  }

  if (error.response?.status === 401) {
    return {
      code: "UNAUTHORIZED",
      message: "Your session has expired.",
      severity: "warning",
    };
  }

  if (error.response?.data?.message) {
    return {
      code: error.response?.data?.code ?? "REQUEST_ERROR",
      message: error.response.data.message,
      severity: "error",
    };
  }

  return {
    code: error.code ?? "UNKNOWN_ERROR",
    message: error.message ?? "Something went wrong.",
    severity: "error",
  };
};
