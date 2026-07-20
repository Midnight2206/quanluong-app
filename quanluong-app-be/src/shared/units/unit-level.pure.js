import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

/**
 * @param {{ id: number, depth: number, parentId: number | null }[]} selfToRoot
 * @returns {number}
 */
export function pickLevel1IdFromChain(selfToRoot) {
  const root = selfToRoot.find((u) => u.depth === 0) ?? selfToRoot[selfToRoot.length - 1];
  if (!root) {
    throw new AppError({
      message: "Unit was not found",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  return root.id;
}
