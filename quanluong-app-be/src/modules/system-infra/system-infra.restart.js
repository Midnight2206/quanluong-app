import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { logger } from "../../shared/utils/logger.js";
import { WATCHED_CONTAINERS } from "./system-infra.classify.js";
import { dockerPost, listContainerIds } from "./system-infra.docker.js";

const RESTARTABLE_CONTAINERS = WATCHED_CONTAINERS.filter((name) => name !== "quanluong-backup");

async function restartContainer(name, deps = {}) {
  if (!RESTARTABLE_CONTAINERS.includes(name)) {
    throw new AppError({
      message: "Không restart container này.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  const list = deps.list ?? listContainerIds;
  const post = deps.post ?? dockerPost;
  let ids;
  try {
    ids = await list();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError({
      message: "Không restart được container.",
      statusCode: 503,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  const id = ids.get(name);
  if (!id) {
    throw new AppError({
      message: "Không thấy container.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  const run = () => post(`/containers/${id}/restart?t=10`);
  if (name === "quanluong-app-be") {
    return { deferred: true, run };
  }
  try {
    await run();
  } catch {
    throw new AppError({
      message: "Không restart được container.",
      statusCode: 503,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  return { deferred: false };
}

function scheduleSelfRestart(res, run, wait = setTimeout) {
  res.on("finish", () => {
    wait(() => {
      Promise.resolve(run()).catch((error) => {
        logger.warn({ err: error }, "Restart API thất bại");
      });
    }, 500);
  });
}

export { RESTARTABLE_CONTAINERS, restartContainer, scheduleSelfRestart };
