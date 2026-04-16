import { respondOk } from "../../backend-response-system/templates/responders";

export const currentUserController =
  ({ usersService }) =>
  async (req, res, next) => {
    try {
      const user = await usersService.getCurrentUser(req.auth.userId);

      return respondOk(res, {
        message: "Current user fetched successfully.",
        data: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          roles: user.roles,
          permissions: user.permissions,
        },
      });
    } catch (error) {
      return next(error);
    }
  };
