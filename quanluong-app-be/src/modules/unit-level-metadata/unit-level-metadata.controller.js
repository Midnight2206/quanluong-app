import { respondSuccess } from "../../shared/utils/responders.js";
import { listUnitLevelMetadata, upsertUnitLevelMetadata } from "./unit-level-metadata.service.js";

async function listUnitLevelMetadataController(_req, res) {
  const rows = await listUnitLevelMetadata();
  return respondSuccess(res, {
    message: "Fetched unit level metadata",
    data: rows,
  });
}

async function upsertUnitLevelMetadataController(req, res) {
  const row = await upsertUnitLevelMetadata(req.validatedParams.depth, req.validatedBody);
  return respondSuccess(res, {
    message: "Saved unit level metadata",
    data: row,
  });
}

export { listUnitLevelMetadataController, upsertUnitLevelMetadataController };
