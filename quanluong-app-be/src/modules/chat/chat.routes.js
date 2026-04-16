import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import {
  createChatGroupController,
  listChatMessagesController,
  listConversationsController,
  listGroupMessagesController,
  markDirectReadController,
  markGroupReadController,
} from "./chat.controller.js";

const chatRouter = express.Router();

chatRouter.use(authMiddleware);
chatRouter.get("/conversations", asyncHandler(listConversationsController));
chatRouter.post("/direct/read", asyncHandler(markDirectReadController));
chatRouter.get("/messages/:peerUserId", asyncHandler(listChatMessagesController));
chatRouter.post("/groups", asyncHandler(createChatGroupController));
chatRouter.get("/groups/:groupId/messages", asyncHandler(listGroupMessagesController));
chatRouter.post("/groups/:groupId/read", asyncHandler(markGroupReadController));

export { chatRouter };
