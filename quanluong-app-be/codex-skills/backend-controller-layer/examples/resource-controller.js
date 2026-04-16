export const listUsersController =
  ({ usersService }) =>
  async (req, res, next) => {
    try {
      const result = await usersService.list({
        query: req.validatedQuery ?? req.query,
      });

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  };
