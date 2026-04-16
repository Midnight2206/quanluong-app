import { normalizeError } from "../templates/error-handler";
import { notifyError, toast } from "../templates/toast-adapter";

export const saveUser = async ({ mutate, payload }) => {
  try {
    await mutate(payload);
    toast.success("User saved successfully.");
  } catch (error) {
    notifyError(normalizeError(error));
    throw error;
  }
};
