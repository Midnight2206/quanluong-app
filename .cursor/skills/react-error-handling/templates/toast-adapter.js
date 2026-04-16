export const toast = {
  success: (message) => {
    console.info("toast.success", message);
  },
  error: (message) => {
    console.error("toast.error", message);
  },
  warning: (message) => {
    console.warn("toast.warning", message);
  },
};

export const notifyError = (normalizedError) => {
  if (normalizedError.severity === "warning") {
    toast.warning(normalizedError.message);
    return;
  }

  toast.error(normalizedError.message);
};
