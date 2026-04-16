export const createUserHandler =
  ({ usersService }) =>
  async (req, res, next) => {
    try {
      const user = await usersService.create(req.validatedBody);
      return res.status(201).json(user);
    } catch (error) {
      return next(error);
    }
  };
