import { respondCreated, respondOk } from "../templates/responders";

export const listUsersController =
  ({ usersService }) =>
  async (req, res, next) => {
    try {
      const data = await usersService.list(req.validatedQuery ?? req.query);
      return respondOk(res, {
        message: "Users fetched successfully.",
        data,
      });
    } catch (error) {
      return next(error);
    }
  };

export const createUserController =
  ({ usersService }) =>
  async (req, res, next) => {
    try {
      const user = await usersService.create(req.validatedBody);
      return respondCreated(res, {
        message: "User created successfully.",
        data: user,
      });
    } catch (error) {
      return next(error);
    }
  };
