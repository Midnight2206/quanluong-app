import { PERMISSIONS } from "../../shared/constants/permissions.js";

const MODULE = "auditLogs";
const READ = {
  code: PERMISSIONS.AUDIT_LOGS_READ,
  name: "View audit logs",
  description: "View login, usage and data-change logs in own unit subtree.",
};

const EXPORT = {
  code: PERMISSIONS.AUDIT_LOGS_EXPORT,
  name: "Export audit logs",
  description: "Download audit logs as Excel using current filters.",
};

const AUDIT_LOGS_ROUTE_DEFINITIONS = [
  { key: "listAuth", method: "GET", module: MODULE, path: "/auth", pathRoute: "/api/audit-logs/auth", permission: READ },
  { key: "listChanges", method: "GET", module: MODULE, path: "/changes", pathRoute: "/api/audit-logs/changes", permission: READ },
  { key: "getChange", method: "GET", module: MODULE, path: "/changes/:id", pathRoute: "/api/audit-logs/changes/:id", permission: READ },
  { key: "listUsage", method: "GET", module: MODULE, path: "/usage", pathRoute: "/api/audit-logs/usage", permission: READ },
  { key: "listUsagePages", method: "GET", module: MODULE, path: "/usage/pages", pathRoute: "/api/audit-logs/usage/pages", permission: READ },
  { key: "exportLogs", method: "GET", module: MODULE, path: "/:tab/export", pathRoute: "/api/audit-logs/:tab/export", permission: EXPORT },
  { key: "listUsers", method: "GET", module: MODULE, path: "/users", pathRoute: "/api/audit-logs/users", permission: READ },
];

export { AUDIT_LOGS_ROUTE_DEFINITIONS };
