import express from "express";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { effectiveUnitScopeMiddleware } from "../../middlewares/effective-unit-scope.middleware.js";
import { unitScopeMiddleware } from "../../middlewares/unit-scope.middleware.js";
import { permissionMiddleware } from "../../middlewares/permission.middleware.js";
import { validateRequest } from "../../middlewares/validate-request.middleware.js";
import {
  createUserController,
  deleteUserController,
  getUserDetailController,
  listUsersController,
  patchUserController,
  replaceUserController,
} from "./users.controller.js";
import { USERS_ROUTE_DEFINITIONS } from "./users.route-definitions.js";
import {
  createUserBodySchema,
  patchUserBodySchema,
  replaceUserBodySchema,
  userParamsSchema,
} from "./users.validator.js";

const usersRouter = express.Router();

const routePermissions = Object.fromEntries(
  USERS_ROUTE_DEFINITIONS.map((routeDefinition) => [routeDefinition.key, routeDefinition.permission.code]),
);

usersRouter.use(authMiddleware);
usersRouter.use(unitScopeMiddleware);
usersRouter.use(effectiveUnitScopeMiddleware);

usersRouter.get(
  "/",
  permissionMiddleware([routePermissions.listUsers]),
  asyncHandler(listUsersController),
);

usersRouter.get(
  "/:id",
  validateRequest({ params: userParamsSchema }),
  permissionMiddleware([routePermissions.getUserDetail]),
  asyncHandler(getUserDetailController),
);

usersRouter.post(
  "/",
  validateRequest({ body: createUserBodySchema }),
  permissionMiddleware([routePermissions.createUser]),
  asyncHandler(createUserController),
);

usersRouter.patch(
  "/:id",
  validateRequest({ params: userParamsSchema, body: patchUserBodySchema }),
  permissionMiddleware([routePermissions.patchUser]),
  asyncHandler(patchUserController),
);

usersRouter.put(
  "/:id",
  validateRequest({ params: userParamsSchema, body: replaceUserBodySchema }),
  permissionMiddleware([routePermissions.replaceUser]),
  asyncHandler(replaceUserController),
);

usersRouter.delete(
  "/:id",
  validateRequest({ params: userParamsSchema }),
  permissionMiddleware([routePermissions.deleteUser]),
  asyncHandler(deleteUserController),
);

export { usersRouter };
