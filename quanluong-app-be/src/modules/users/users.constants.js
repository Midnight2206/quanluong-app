import { PERMISSIONS } from "../../shared/constants/permissions.js";

const USERS_MODULE_NAME = "users";

const USER_DEFAULT_SELECT = {
  id: true,
  username: true,
  email: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

const USERS_PERMISSIONS = {
  LIST: PERMISSIONS.USERS_READ,
  DETAIL: PERMISSIONS.USERS_DETAIL,
  CREATE: PERMISSIONS.USERS_CREATE,
  PATCH: PERMISSIONS.USERS_PATCH,
  PUT: PERMISSIONS.USERS_PUT,
  DELETE: PERMISSIONS.USERS_DELETE,
};

export { USER_DEFAULT_SELECT, USERS_MODULE_NAME, USERS_PERMISSIONS };
