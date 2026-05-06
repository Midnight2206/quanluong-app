import { respondSuccess } from "../../shared/utils/responders.js";
import { getChungTuQuyetToanHealth } from "./chung-tu-quyet-toan.service.js";

async function chungTuQuyetToanHealthController(req, res) {
  const data = await getChungTuQuyetToanHealth({
    user: req.user,
    unitScope: req.unitScope,
    effectiveUnitIds: req.effectiveUnitIds,
  });
  return respondSuccess(res, {
    message: "ChungTuQuyetToan API is healthy",
    data,
  });
}

export { chungTuQuyetToanHealthController };
