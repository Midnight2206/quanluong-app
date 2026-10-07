import { respondSuccess } from "../../shared/utils/responders.js";
import { readInfra } from "./system-infra.service.js";

async function getSystemInfraController(_req, res) {
  return respondSuccess(res, {
    message: "Tình trạng hạ tầng",
    data: await readInfra(),
  });
}

export { getSystemInfraController };
