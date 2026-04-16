import { respondOk } from "../../backend-response-system/templates/responders";

export const listResourcesController =
  ({ service }) =>
  async (req, res, next) => {
    try {
      const result = await service.list(req.validatedQuery ?? req.query);

      return respondOk(res, {
        message: "Resources fetched successfully.",
        data: result.items,
        meta: result.meta,
      });
    } catch (error) {
      return next(error);
    }
  };
