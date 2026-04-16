import { useAuthStore } from "../templates/auth-store";

export const bootstrapCurrentUser = async ({ getCurrentUser }) => {
  const { setAuthLoading, setAuthenticatedUser, setUnauthenticated } =
    useAuthStore.getState();

  setAuthLoading();

  try {
    const user = await getCurrentUser();
    setAuthenticatedUser(user);
  } catch {
    setUnauthenticated();
  }
};
