import {
  setAuthenticatedUser,
  setAuthLoading,
  setUnauthenticated,
} from "../templates/auth-store";

export const bootstrapCurrentUser = async ({ dispatch, getCurrentUser }) => {
  dispatch(setAuthLoading());

  try {
    const user = await getCurrentUser();
    dispatch(setAuthenticatedUser(user));
  } catch {
    dispatch(setUnauthenticated());
  }
};
