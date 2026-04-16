import { respondCreated, respondSuccess } from "../../shared/utils/responders.js";
import { mapUser } from "./users.mapper.js";
import {
  createUser,
  getUserById,
  listUsers,
  patchUser,
  replaceUser,
  softDeleteUser,
} from "./users.service.js";

async function listUsersController(req, res) {
  const users = await listUsers(req.unitScope, req.effectiveUnitIds);

  return respondSuccess(res, {
    message: "Fetched users successfully",
    data: users.map(mapUser),
  });
}

async function getUserDetailController(req, res) {
  const user = await getUserById(req.validatedParams.id, req.unitScope, req.effectiveUnitIds);

  return respondSuccess(res, {
    message: "Fetched user successfully",
    data: mapUser(user),
  });
}

async function createUserController(req, res) {
  const user = await createUser(req.validatedBody, req.unitScope, req.effectiveUnitIds);

  return respondCreated(res, {
    message: "Created user successfully",
    data: mapUser(user),
  });
}

async function patchUserController(req, res) {
  const user = await patchUser(req.validatedParams.id, req.validatedBody, req.unitScope, {
    actorId: req.user?.id ?? null,
    effectiveUnitIds: req.effectiveUnitIds,
  });

  return respondSuccess(res, {
    message: "Updated user successfully",
    data: mapUser(user),
  });
}

async function replaceUserController(req, res) {
  const user = await replaceUser(
    req.validatedParams.id,
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
  );

  return respondSuccess(res, {
    message: "Replaced user successfully",
    data: mapUser(user),
  });
}

async function deleteUserController(req, res) {
  const user = await softDeleteUser(req.validatedParams.id, req.unitScope, req.effectiveUnitIds);

  return respondSuccess(res, {
    message: "Deleted user successfully",
    data: mapUser(user),
  });
}

export {
  createUserController,
  deleteUserController,
  getUserDetailController,
  listUsersController,
  patchUserController,
  replaceUserController,
};
