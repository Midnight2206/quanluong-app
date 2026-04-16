import jwt from "jsonwebtoken";
import { config } from "../../config/config.js";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { logger } from "../../shared/utils/logger.js";
import { createChatMessage, createGroupMessage } from "./chat.service.js";

/**
 * @param {string|undefined} cookieHeader
 */
function parseCookieHeader(cookieHeader) {
  const out = {};
  if (!cookieHeader || typeof cookieHeader !== "string") {
    return out;
  }
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) {
      continue;
    }
    const key = part.slice(0, idx).trim();
    let val = part.slice(idx + 1).trim();
    try {
      val = decodeURIComponent(val);
    } catch {
      /* keep raw */
    }
    out[key] = val;
  }
  return out;
}

/**
 * Xác thực cookie access JWT (giống phía API; không bắt buộc session cookie cho socket).
 * @param {import("socket.io").Socket} socket
 */
function resolveUserIdFromSocket(socket) {
  const raw = socket.handshake.headers.cookie;
  const cookies = parseCookieHeader(raw);
  const token = cookies[config.auth.accessTokenCookieName];
  if (!token) {
    return null;
  }
  try {
    const payload = jwt.verify(token, config.auth.jwtAccessSecret);
    const sub = payload?.sub;
    const id = sub != null ? Number(sub) : NaN;
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

/**
 * @param {import("socket.io").Server} io
 */
function registerChatSocket(io) {
  io.use((socket, next) => {
    const userId = resolveUserIdFromSocket(socket);
    if (!userId) {
      return next(new Error("unauthorized"));
    }
    socket.data.userId = userId;
    return next();
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.userId;
    socket.join(`user:${userId}`);

    try {
      const memberships = await prisma.chatGroupMember.findMany({
        where: { userId },
        select: { groupId: true },
      });
      for (const m of memberships) {
        socket.join(`group:${m.groupId}`);
      }
    } catch (err) {
      logger.warn({ err, userId }, "chat socket: failed to join group rooms");
    }

    socket.on("chat:send", async (payload, ack) => {
      try {
        const peerUserId = Number(payload?.peerUserId);
        const text = String(payload?.text ?? "");

        if (!Number.isFinite(peerUserId) || peerUserId <= 0) {
          if (typeof ack === "function") {
            ack({ ok: false, error: "peerUserId không hợp lệ" });
          }
          return;
        }

        const saved = await createChatMessage({
          senderId: userId,
          recipientId: peerUserId,
          body: text,
        });

        const messagePayload = {
          kind: "direct",
          id: saved.id,
          body: saved.body,
          createdAt: saved.createdAt.toISOString(),
          senderId: userId,
          recipientId: peerUserId,
          peerUserId: userId,
        };

        io.to(`user:${peerUserId}`).emit("chat:message", messagePayload);

        if (typeof ack === "function") {
          ack({
            ok: true,
            message: {
              id: saved.id,
              senderId: userId,
              recipientId: peerUserId,
              body: saved.body,
              createdAt: saved.createdAt.toISOString(),
            },
          });
        }
      } catch (err) {
        logger.warn({ err, userId }, "chat:send failed");
        if (typeof ack === "function") {
          ack({ ok: false, error: err?.message ?? "send failed" });
        }
      }
    });

    socket.on("chat:typing", (payload) => {
      const peerUserId = Number(payload?.peerUserId);
      if (!Number.isFinite(peerUserId) || peerUserId <= 0 || peerUserId === userId) {
        return;
      }
      socket.to(`user:${peerUserId}`).emit("chat:typing", { fromUserId: userId });
    });

    socket.on("group:typing", async (payload) => {
      const groupId = Number(payload?.groupId);
      if (!Number.isFinite(groupId) || groupId <= 0) {
        return;
      }
      try {
        const mem = await prisma.chatGroupMember.findUnique({
          where: { groupId_userId: { groupId, userId } },
          select: { groupId: true },
        });
        if (!mem) {
          return;
        }
        socket.to(`group:${groupId}`).emit("group:typing", { groupId, fromUserId: userId });
      } catch (err) {
        logger.warn({ err, userId }, "group:typing failed");
      }
    });

    socket.on("group:subscribe", async (payload, ack) => {
      try {
        const groupId = Number(payload?.groupId);
        if (!Number.isFinite(groupId) || groupId <= 0) {
          if (typeof ack === "function") {
            ack({ ok: false, error: "groupId không hợp lệ" });
          }
          return;
        }
        const mem = await prisma.chatGroupMember.findUnique({
          where: { groupId_userId: { groupId, userId } },
          select: { groupId: true },
        });
        if (!mem) {
          if (typeof ack === "function") {
            ack({ ok: false, error: "Không thuộc nhóm" });
          }
          return;
        }
        socket.join(`group:${groupId}`);
        if (typeof ack === "function") {
          ack({ ok: true });
        }
      } catch (err) {
        logger.warn({ err, userId }, "group:subscribe failed");
        if (typeof ack === "function") {
          ack({ ok: false, error: err?.message ?? "subscribe failed" });
        }
      }
    });

    socket.on("group:send", async (payload, ack) => {
      try {
        const groupId = Number(payload?.groupId);
        const text = String(payload?.text ?? "");

        if (!Number.isFinite(groupId) || groupId <= 0) {
          if (typeof ack === "function") {
            ack({ ok: false, error: "groupId không hợp lệ" });
          }
          return;
        }

        const saved = await createGroupMessage({
          senderId: userId,
          groupId,
          body: text,
        });

        const out = {
          kind: "group",
          id: saved.id,
          groupId: saved.groupId,
          senderId: saved.senderId,
          body: saved.body,
          createdAt: saved.createdAt.toISOString(),
        };

        socket.to(`group:${groupId}`).emit("chat:group:message", out);

        if (typeof ack === "function") {
          ack({
            ok: true,
            message: {
              id: saved.id,
              groupId: saved.groupId,
              senderId: saved.senderId,
              body: saved.body,
              createdAt: saved.createdAt.toISOString(),
            },
          });
        }
      } catch (err) {
        logger.warn({ err, userId }, "group:send failed");
        if (typeof ack === "function") {
          ack({ ok: false, error: err?.message ?? "send failed" });
        }
      }
    });

    socket.on("disconnect", (reason) => {
      logger.debug({ userId, reason }, "chat socket disconnect");
    });
  });
}

export { registerChatSocket };
