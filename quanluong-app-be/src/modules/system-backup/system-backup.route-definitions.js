import { PERMISSIONS } from "../../shared/constants/permissions.js";

const SYSTEM_BACKUP_ROUTE_DEFINITIONS = [
  {
    key: "getSystemBackup",
    method: "GET",
    module: "systemBackup",
    path: "/",
    pathRoute: "/api/system-backup",
    permission: {
      code: PERMISSIONS.SYSTEM_BACKUP_MANAGE,
      name: "Backup và khôi phục dữ liệu",
      description: "Xem lịch backup.",
    },
  },
  {
    key: "runSystemBackup",
    method: "POST",
    module: "systemBackup",
    path: "/backup",
    pathRoute: "/api/system-backup/backup",
    permission: {
      code: PERMISSIONS.SYSTEM_BACKUP_MANAGE,
      name: "Backup và khôi phục dữ liệu",
      description: "Chạy backup.",
    },
  },
  {
    key: "restoreSystemBackup",
    method: "POST",
    module: "systemBackup",
    path: "/restore",
    pathRoute: "/api/system-backup/restore",
    permission: {
      code: PERMISSIONS.SYSTEM_BACKUP_MANAGE,
      name: "Backup và khôi phục dữ liệu",
      description: "Khôi phục một ngày.",
    },
  },
  {
    key: "getSystemBackupLog",
    method: "GET",
    module: "systemBackup",
    path: "/log",
    pathRoute: "/api/system-backup/log",
    permission: {
      code: PERMISSIONS.SYSTEM_BACKUP_MANAGE,
      name: "Backup và khôi phục dữ liệu",
      description: "Xem nhật ký backup.",
    },
  },
];

export { SYSTEM_BACKUP_ROUTE_DEFINITIONS };
