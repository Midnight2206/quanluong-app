import { respondSuccess } from "../../shared/utils/responders.js";
import { queueBackup, queueRestore, readBackupLogTail, readBackupState } from "./system-backup.service.js";

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

async function runSystemBackupController(_req, res) {
  const result = await queueBackup();
  return respondSuccess(res, {
    statusCode: 202,
    message: "Đã nhận lệnh backup",
    data: result,
  });
}

async function getSystemBackupLogController(_req, res) {
  return respondSuccess(res, {
    message: "Log backup",
    data: { lines: await readBackupLogTail() },
  });
}

export {
  getSystemBackupController,
  getSystemBackupLogController,
  restoreSystemBackupController,
  runSystemBackupController,
};
