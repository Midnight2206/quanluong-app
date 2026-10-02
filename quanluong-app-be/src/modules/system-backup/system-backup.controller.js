import { respondSuccess } from "../../shared/utils/responders.js";
import { queueRestore, readBackupState } from "./system-backup.service.js";

async function getSystemBackupController(_req, res) {
  return respondSuccess(res, {
    message: "Danh sách bản backup",
    data: await readBackupState(),
  });
}

async function restoreSystemBackupController(req, res) {
  const status = await queueRestore(req.body.date);
  return respondSuccess(res, {
    statusCode: 202,
    message: "Đã nhận lệnh khôi phục",
    data: status,
  });
}

export { getSystemBackupController, restoreSystemBackupController };
