import { respondSuccess } from "../../shared/utils/responders.js";
import { restartContainer, scheduleSelfRestart } from "./system-infra.restart.js";
import { readInfra } from "./system-infra.service.js";

async function getSystemInfraController(_req, res) {
  return respondSuccess(res, {
    message: "Tình trạng hạ tầng",
    data: await readInfra(),
  });
}

function respondRestartAccepted(res, name, result) {
  if (result.deferred) {
    scheduleSelfRestart(res, result.run);
  }
  return respondSuccess(res, {
    statusCode: 202,
    message: "Đã nhận lệnh restart",
    data: { name },
  });
}

async function restartSystemInfraController(req, res) {
  const result = await restartContainer(req.params.name);
  return respondRestartAccepted(res, req.params.name, result);
}

export {
  getSystemInfraController,
  respondRestartAccepted,
  restartSystemInfraController,
};
