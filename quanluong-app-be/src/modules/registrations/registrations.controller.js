import { respondSuccess } from "../../shared/utils/responders.js";
import { mapUser } from "../users/users.mapper.js";
import {
  approveRegistration,
  listPendingRegistrations,
  rejectRegistration,
} from "./registrations.service.js";

async function listPendingRegistrationsController(req, res) {
  const rows = await listPendingRegistrations(req.unitScope);

  return respondSuccess(res, {
    message: "Fetched pending registrations",
    data: rows.map(mapUser),
  });
}

async function approveRegistrationController(req, res) {
  const user = await approveRegistration({
    targetUserId: req.validatedParams.userId,
    reviewer: req.user,
    scope: req.unitScope,
  });

  return respondSuccess(res, {
    message: "Registration approved",
    data: mapUser(user),
  });
}

async function rejectRegistrationController(req, res) {
  const user = await rejectRegistration({
    targetUserId: req.validatedParams.userId,
    reviewer: req.user,
    scope: req.unitScope,
    note: req.validatedBody?.note,
  });

  return respondSuccess(res, {
    message: "Registration rejected",
    data: mapUser(user),
  });
}

export {
  approveRegistrationController,
  listPendingRegistrationsController,
  rejectRegistrationController,
};
