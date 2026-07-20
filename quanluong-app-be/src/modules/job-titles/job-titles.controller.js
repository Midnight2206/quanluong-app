import { respondCreated, respondSuccess } from "../../shared/utils/responders.js";
import { mapJobTitle } from "./job-titles.mapper.js";
import {
  createJobTitle,
  deactivateJobTitle,
  getJobTitleById,
  listJobTitles,
  patchJobTitle,
  setJobTitlePermissions,
} from "./job-titles.service.js";

async function listJobTitlesController(req, res) {
  const rows = await listJobTitles(req.unitScope, req.effectiveUnitIds, req.dataScope);
  return respondSuccess(res, {
    message: "Fetched job titles",
    data: rows.map(mapJobTitle),
  });
}

async function getJobTitleController(req, res) {
  const row = await getJobTitleById(
    req.validatedParams.id,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: "Fetched job title",
    data: mapJobTitle(row),
  });
}

async function createJobTitleController(req, res) {
  const row = await createJobTitle(
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondCreated(res, {
    message: "Created job title",
    data: mapJobTitle(row),
  });
}

async function patchJobTitleController(req, res) {
  const row = await patchJobTitle(
    req.validatedParams.id,
    req.validatedBody,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: "Updated job title",
    data: mapJobTitle(row),
  });
}

async function deleteJobTitleController(req, res) {
  const row = await deactivateJobTitle(
    req.validatedParams.id,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: "Job title deactivated",
    data: mapJobTitle(row),
  });
}

async function setJobTitlePermissionsController(req, res) {
  const row = await setJobTitlePermissions(
    req.validatedParams.id,
    req.validatedBody.permissionIds,
    req.user,
    req.unitScope,
    req.effectiveUnitIds,
    req.dataScope,
  );
  return respondSuccess(res, {
    message: "Updated job title permissions",
    data: mapJobTitle(row),
  });
}

export {
  createJobTitleController,
  deleteJobTitleController,
  getJobTitleController,
  listJobTitlesController,
  patchJobTitleController,
  setJobTitlePermissionsController,
};
