import { USERS_MODULE_NAME, USERS_PERMISSIONS } from "./users.constants.js";

const USERS_ROUTE_DEFINITIONS = [
  {
    key: "listUsers",
    method: "GET",
    module: USERS_MODULE_NAME,
    path: "/",
    pathRoute: "/api/users",
    permission: {
      code: USERS_PERMISSIONS.LIST,
      name: "View users",
      description: "View the list of users and their profile summaries.",
    },
  },
  {
    key: "getUserDetail",
    method: "GET",
    module: USERS_MODULE_NAME,
    path: "/:id",
    pathRoute: "/api/users/:id",
    permission: {
      code: USERS_PERMISSIONS.DETAIL,
      name: "View user detail",
      description: "View detailed information for one user, including profile and authorization data.",
    },
  },
  {
    key: "createUser",
    method: "POST",
    module: USERS_MODULE_NAME,
    path: "/",
    pathRoute: "/api/users",
    permission: {
      code: USERS_PERMISSIONS.CREATE,
      name: "Create user",
      description: "Create a new user and the user's profile.",
    },
  },
  {
    key: "patchUser",
    method: "PATCH",
    module: USERS_MODULE_NAME,
    path: "/:id",
    pathRoute: "/api/users/:id",
    permission: {
      code: USERS_PERMISSIONS.PATCH,
      name: "Update part of user",
      description: "Update selected user fields or profile fields.",
    },
  },
  {
    key: "replaceUser",
    method: "PUT",
    module: USERS_MODULE_NAME,
    path: "/:id",
    pathRoute: "/api/users/:id",
    permission: {
      code: USERS_PERMISSIONS.PUT,
      name: "Replace user",
      description: "Replace the full user and profile payload for one user.",
    },
  },
  {
    key: "deleteUser",
    method: "DELETE",
    module: USERS_MODULE_NAME,
    path: "/:id",
    pathRoute: "/api/users/:id",
    permission: {
      code: USERS_PERMISSIONS.DELETE,
      name: "Delete user",
      description: "Soft delete a user account.",
    },
  },
];

export { USERS_ROUTE_DEFINITIONS };
