import { respondSuccess } from "../../shared/utils/responders.js";
import { listTypes } from "./types.service.js";

async function listTypesController(_req, res) {
  const types = await listTypes();

  return respondSuccess(res, {
    message: "Fetched types successfully",
    data: types,
  });
}

export { listTypesController };
