import { respondCreated, respondSuccess } from "../../shared/utils/responders.js";
import { mapJobTitle } from "./job-titles.mapper.js";
import {
  applyJobTitleToDescendantUnit,
  createJobTitle,
  deactivateJobTitle,
  getJobTitleById,
  listJobTitles,
  patchJobTitle,
  setJobTitlePermissions,
} from "./job-titles.service.js";

async function listJobTitlesController(req, res) {
  const rows = await listJobTitles(req.unitScope, req.effectiveUnitIds);
  return respondSuccess(res, {
    message: "Fetched job titles",
    data: rows.map(mapJobTitle),
  });
}

async function getJobTitleController(req, res) {
  const row = await getJobTitleById(req.validatedParams.id, req.unitScope, req.effectiveUnitIds);
  return respondSuccess(res, {
    message: "Fetched job title",
    data: mapJobTitle(row),
  });
}

async function createJobTitleController(req, res) {
  const row = await createJobTitle(req.validatedBody, req.unitScope, req.effectiveUnitIds);
  return respondCreated(res, {
    message: "Created job title",
    data: mapJobTitle(row),
  });
}

async function patchJobTitleController(req, res) {
  const row = await patchJobTitle(req.validatedParams.id, req.validatedBody, req.unitScope, req.effectiveUnitIds);
  return respondSuccess(res, {
    message: "Updated job title",
    data: mapJobTitle(row),
  });
}

async function deleteJobTitleController(req, res) {
  const row = await deactivateJobTitle(req.validatedParams.id, req.unitScope, req.effectiveUnitIds);
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
  );
  return respondSuccess(res, {
    message: "Updated job title permissions",
    data: mapJobTitle(row),
  });
}

async function applyJobTitleToUnitController(req, res) {
  const body = req.validatedBody;
  const rawIds =
    body.targetUnitIds != null && body.targetUnitIds.length > 0
      ? body.targetUnitIds
      : body.targetUnitId != null
        ? [body.targetUnitId]
        : [];
  const targetUnitIds = [...new Set(rawIds.map((n) => Number(n)))];

  const results = [];
  for (const targetUnitId of targetUnitIds) {
    const row = await applyJobTitleToDescendantUnit(
      req.validatedParams.id,
      targetUnitId,
      req.user,
      req.unitScope,
      req.effectiveUnitIds,
    );
    results.push(mapJobTitle(row));
  }

  if (results.length === 1) {
    return respondSuccess(res, {
      message: "Đã áp chức danh xuống đơn vị con (tạo mới hoặc đồng bộ nếu đã áp trước đó)",
      data: results[0],
    });
  }
  return respondSuccess(res, {
    message: `Đã áp chức danh xuống ${results.length} đơn vị con (đồng bộ theo fork — dùng chung nguồn với đơn vị cha).`,
    data: { results },
  });
}

export {
  applyJobTitleToUnitController,
  createJobTitleController,
  deleteJobTitleController,
  getJobTitleController,
  listJobTitlesController,
  patchJobTitleController,
  setJobTitlePermissionsController,
};
