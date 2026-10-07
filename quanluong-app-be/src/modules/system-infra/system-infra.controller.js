import { respondSuccess } from "../../shared/utils/responders.js";
import { restartContainer, scheduleSelfRestart } from "./system-infra.restart.js";
import { readInfra } from "./system-infra.service.js";

async function getSystemInfraController(_req, res) {
  return respondSuccess(res, {
    message: "Tình trạng hạ tầng",
    data: await readInfra(),
  });
}

async function restartSystemInfraController(req, res) {
  const result = await restartContainer(req.params.name);
  respondSuccess(res, {
    statusCode: 202,
    message: "Đã nhận lệnh restart",
    data: { name: req.params.name },
  });
  if (result.deferred) {
    scheduleSelfRestart(res, result.run);
  }
}

export { getSystemInfraController, restartSystemInfraController };
