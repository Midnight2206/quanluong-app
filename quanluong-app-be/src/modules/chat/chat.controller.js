import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { respondCreated, respondSuccess } from "../../shared/utils/responders.js";
import {
  createChatGroup,
  listChatMessagesBetween,
  listConversationsForUser,
  listGroupMessages,
  markDirectThreadRead,
  markGroupThreadRead,
} from "./chat.service.js";

/**
 * GET /api/chat/conversations
 */
async function listConversationsController(req, res) {
  const rows = await listConversationsForUser(req.user.id);
  return respondSuccess(res, {
    message: "Fetched conversations",
    data: rows,
  });
}

/**
 * GET /api/chat/messages/:peerUserId
 */
async function listChatMessagesController(req, res) {
  const peerUserId = Number(req.params.peerUserId);
  if (!Number.isFinite(peerUserId) || peerUserId <= 0) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "peerUserId không hợp lệ.",
    });
  }
  const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
  const beforeRaw = req.query.before != null ? Number(req.query.before) : undefined;
  const beforeId = Number.isFinite(beforeRaw) ? beforeRaw : undefined;
  const messages = await listChatMessagesBetween(req.user.id, peerUserId, { limit, beforeId });

  return respondSuccess(res, {
    message: "Fetched chat messages",
    data: messages,
  });
}

/**
 * POST /api/chat/direct/read  { peerUserId }
 */
async function markDirectReadController(req, res) {
  const peerUserId = Number(req.body?.peerUserId);
  if (!Number.isFinite(peerUserId) || peerUserId <= 0) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "peerUserId không hợp lệ.",
    });
  }
  await markDirectThreadRead(req.user.id, peerUserId);
  return respondSuccess(res, { message: "Marked read", data: { peerUserId } });
}

/**
 * POST /api/chat/groups  { name, memberUserIds: number[] }
 */
async function createChatGroupController(req, res) {
  const name = req.body?.name;
  const memberUserIds = req.body?.memberUserIds;
  const group = await createChatGroup({
    creatorId: req.user.id,
    name,
    memberUserIds,
  });
  return respondCreated(res, {
    message: "Tạo nhóm thành công",
    data: group,
  });
}

/**
 * GET /api/chat/groups/:groupId/messages
 */
async function listGroupMessagesController(req, res) {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId) || groupId <= 0) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "groupId không hợp lệ.",
    });
  }
  const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
  const beforeRaw = req.query.before != null ? Number(req.query.before) : undefined;
  const beforeId = Number.isFinite(beforeRaw) ? beforeRaw : undefined;
  const messages = await listGroupMessages(req.user.id, groupId, { limit, beforeId });
  return respondSuccess(res, {
    message: "Fetched group messages",
    data: messages,
  });
}

/**
 * POST /api/chat/groups/:groupId/read
 */
async function markGroupReadController(req, res) {
  const groupId = Number(req.params.groupId);
  if (!Number.isFinite(groupId) || groupId <= 0) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "groupId không hợp lệ.",
    });
  }
  await markGroupThreadRead(req.user.id, groupId);
  return respondSuccess(res, { message: "Marked read", data: { groupId } });
}

export {
  createChatGroupController,
  listChatMessagesController,
  listConversationsController,
  listGroupMessagesController,
  markDirectReadController,
  markGroupReadController,
};
