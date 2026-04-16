import { PERMISSIONS_MODULE_NAME, PERMISSIONS_PERMISSIONS } from "./permissions.constants.js";

const PERMISSIONS_ROUTE_DEFINITIONS = [
  {
    key: "listPermissions",
    method: "GET",
    module: PERMISSIONS_MODULE_NAME,
    path: "/",
    pathRoute: "/api/permissions",
    permission: {
      code: PERMISSIONS_PERMISSIONS.READ,
      name: "List permissions catalog",
      description: "View all system permissions and their descriptions (superadmin workflow).",
    },
  },
  {
    key: "patchPermissionDescription",
    method: "PATCH",
    module: PERMISSIONS_MODULE_NAME,
    path: "/:id",
    pathRoute: "/api/permissions/:id",
    permission: {
      code: PERMISSIONS_PERMISSIONS.PATCH,
      name: "Update permission description",
      description: "Edit user-facing description text for a permission entry.",
    },
  },
];

export { PERMISSIONS_ROUTE_DEFINITIONS };
