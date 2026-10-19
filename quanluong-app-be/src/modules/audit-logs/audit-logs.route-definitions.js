import { PERMISSIONS } from "../../shared/constants/permissions.js";

const MODULE = "auditLogs";
const READ = {
  code: PERMISSIONS.AUDIT_LOGS_READ,
  name: "View audit logs",
  description: "View login, usage and data-change logs in own unit subtree.",
};

const AUDIT_LOGS_ROUTE_DEFINITIONS = [
  { key: "listAuth", method: "GET", module: MODULE, path: "/auth", pathRoute: "/api/audit-logs/auth", permission: READ },
  { key: "listUsers", method: "GET", module: MODULE, path: "/users", pathRoute: "/api/audit-logs/users", permission: READ },
];

export { AUDIT_LOGS_ROUTE_DEFINITIONS };
