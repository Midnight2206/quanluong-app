import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

const MAX_BODY = 8000;
const MAX_GROUP_NAME = 191;
const MAX_CONVERSATION_PEERS = 200;

const peerSelect = {
  id: true,
  username: true,
  profile: { select: { fullName: true, avatarUrl: true } },
};

/**
 * @param {{ senderId: number, recipientId: number, body: string }} input
 */
async function createChatMessage(input) {
  const body = String(input.body ?? "").trim().slice(0, MAX_BODY);
  if (!body) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Nội dung tin nhắn không được để trống.",
    });
  }
  if (input.senderId === input.recipientId) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Không thể gửi tin cho chính mình.",
    });
  }

  const recipient = await prisma.user.findFirst({
    where: {
      id: input.recipientId,
      deletedAt: null,
      isActive: true,
    },
    select: { id: true },
  });
  if (!recipient) {
    throw new AppError({
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
      message: "Không tìm thấy người nhận.",
    });
  }

  return prisma.chatMessage.create({
    data: {
      senderId: input.senderId,
      recipientId: input.recipientId,
      body,
    },
    select: {
      id: true,
      senderId: true,
      recipientId: true,
      body: true,
      createdAt: true,
    },
  });
}

/**
 * @param {number} userId
 * @param {number} peerUserId
 * @param {{ limit?: number, beforeId?: number }} [opts]
 * `beforeId`: chỉ lấy tin có `id` nhỏ hơn (lazy load tin cũ hơn).
 */
async function listChatMessagesBetween(userId, peerUserId, opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 40, 1), 200);
  if (userId === peerUserId) {
    return [];
  }

  const beforeId =
    opts.beforeId != null && Number.isFinite(Number(opts.beforeId)) ? Math.floor(Number(opts.beforeId)) : null;

  const pairOr = [
    { senderId: userId, recipientId: peerUserId },
    { senderId: peerUserId, recipientId: userId },
  ];

  const rows = await prisma.chatMessage.findMany({
    where: {
      AND: [
        { OR: pairOr },
        ...(beforeId != null ? [{ id: { lt: beforeId } }] : []),
      ],
    },
    orderBy: { id: "desc" },
    take: limit,
    select: {
      id: true,
      senderId: true,
      recipientId: true,
      body: true,
      createdAt: true,
    },
  });

  return rows.reverse();
}

/**
 * @param {number} userId
 * @param {number} peerUserId
 */
async function markDirectThreadRead(userId, peerUserId) {
  if (userId === peerUserId) {
    return;
  }
  const now = new Date();
  await prisma.chatDirectReadState.upsert({
    where: {
      userId_peerUserId: { userId, peerUserId },
    },
    create: { userId, peerUserId, lastReadAt: now },
    update: { lastReadAt: now },
  });
}

/**
 * @param {number} userId
 * @param {number} groupId
 */
async function markGroupThreadRead(userId, groupId) {
  const mem = await prisma.chatGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { groupId: true },
  });
  if (!mem) {
    throw new AppError({
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
      message: "Bạn không thuộc nhóm này.",
    });
  }
  await prisma.chatGroupMember.update({
    where: { groupId_userId: { groupId, userId } },
    data: { lastReadAt: new Date() },
  });
}

/**
 * @param {number} userId
 * @param {number} groupId
 * @param {{ limit?: number, beforeId?: number }} [opts]
 */
async function listGroupMessages(userId, groupId, opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 40, 1), 200);
  const beforeId =
    opts.beforeId != null && Number.isFinite(Number(opts.beforeId)) ? Math.floor(Number(opts.beforeId)) : null;

  const mem = await prisma.chatGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { groupId: true },
  });
  if (!mem) {
    throw new AppError({
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
      message: "Bạn không thuộc nhóm này.",
    });
  }
  const rows = await prisma.chatGroupMessage.findMany({
    where: {
      groupId,
      ...(beforeId != null ? { id: { lt: beforeId } } : {}),
    },
    orderBy: { id: "desc" },
    take: limit,
    select: {
      id: true,
      groupId: true,
      senderId: true,
      body: true,
      createdAt: true,
    },
  });
  return rows.reverse();
}

/**
 * @param {{ senderId: number, groupId: number, body: string }} input
 */
async function createGroupMessage(input) {
  const body = String(input.body ?? "").trim().slice(0, MAX_BODY);
  if (!body) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Nội dung tin nhắn không được để trống.",
    });
  }
  const mem = await prisma.chatGroupMember.findUnique({
    where: { groupId_userId: { groupId: input.groupId, userId: input.senderId } },
    select: { groupId: true },
  });
  if (!mem) {
    throw new AppError({
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
      message: "Bạn không thuộc nhóm này.",
    });
  }
  return prisma.chatGroupMessage.create({
    data: {
      groupId: input.groupId,
      senderId: input.senderId,
      body,
    },
    select: {
      id: true,
      groupId: true,
      senderId: true,
      body: true,
      createdAt: true,
    },
  });
}

/**
 * @param {{ creatorId: number, name: string, memberUserIds: number[] }} input
 */
async function createChatGroup(input) {
  const name = String(input.name ?? "").trim().slice(0, MAX_GROUP_NAME);
  if (!name) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Tên nhóm không được để trống.",
    });
  }
  const creatorId = input.creatorId;
  const rawIds = Array.isArray(input.memberUserIds) ? input.memberUserIds : [];
  const memberSet = new Set([creatorId, ...rawIds.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)]);
  memberSet.delete(creatorId);
  const others = [...memberSet];
  if (others.length < 1) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Nhóm cần ít nhất một thành viên khác ngoài bạn.",
    });
  }
  const allIds = [creatorId, ...others];
  const users = await prisma.user.findMany({
    where: {
      id: { in: allIds },
      deletedAt: null,
      isActive: true,
    },
    select: { id: true },
  });
  if (users.length !== allIds.length) {
    throw new AppError({
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Một hoặc nhiều thành viên không hợp lệ.",
    });
  }

  const group = await prisma.$transaction(async (tx) => {
    const g = await tx.chatGroup.create({
      data: {
        name,
        createdById: creatorId,
        members: {
          create: allIds.map((userId) => ({ userId })),
        },
      },
      select: { id: true, name: true, createdAt: true, createdById: true },
    });
    return g;
  });

  return group;
}

/**
 * @param {number} userId
 */
async function listConversationsForUser(userId) {
  /** @type {Array<{ kind: 'direct', peerUserId: number, lastMessage: object, unreadCount: number, updatedAt: Date, peer: object } | { kind: 'group', groupId: number, name: string, lastMessage: object | null, unreadCount: number, updatedAt: Date }>} */
  const items = [];

  const directAgg = await prisma.$queryRaw`
    SELECT
      CASE WHEN \`senderId\` = ${userId} THEN \`recipientId\` ELSE \`senderId\` END AS \`peerUserId\`,
      MAX(\`createdAt\`) AS \`lastAt\`
    FROM \`ChatMessage\`
    WHERE \`senderId\` = ${userId} OR \`recipientId\` = ${userId}
    GROUP BY CASE WHEN \`senderId\` = ${userId} THEN \`recipientId\` ELSE \`senderId\` END
    LIMIT ${MAX_CONVERSATION_PEERS}
  `;

  const peerIds = directAgg.map((r) => Number(r.peerUserId)).filter((n) => Number.isFinite(n));
  const readStates =
    peerIds.length === 0
      ? []
      : await prisma.chatDirectReadState.findMany({
          where: { userId, peerUserId: { in: peerIds } },
        });
  const readMap = new Map(readStates.map((s) => [s.peerUserId, s.lastReadAt]));

  const peers =
    peerIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: peerIds }, deletedAt: null },
          select: peerSelect,
        });
  const peerById = new Map(peers.map((p) => [p.id, p]));

  for (const row of directAgg) {
    const peerUserId = Number(row.peerUserId);
    if (!Number.isFinite(peerUserId)) {
      continue;
    }
    const lastMsg = await prisma.chatMessage.findFirst({
      where: {
        OR: [
          { senderId: userId, recipientId: peerUserId },
          { senderId: peerUserId, recipientId: userId },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        senderId: true,
        recipientId: true,
        body: true,
        createdAt: true,
      },
    });
    if (!lastMsg) {
      continue;
    }
    const lastRead = readMap.get(peerUserId) ?? null;
    const unreadWhere = {
      senderId: peerUserId,
      recipientId: userId,
      ...(lastRead ? { createdAt: { gt: lastRead } } : {}),
    };
    const unreadCount = await prisma.chatMessage.count({ where: unreadWhere });

    items.push({
      kind: "direct",
      peerUserId,
      peer: peerById.get(peerUserId) ?? { id: peerUserId, username: `#${peerUserId}`, profile: null },
      lastMessage: {
        id: lastMsg.id,
        senderId: lastMsg.senderId,
        recipientId: lastMsg.recipientId,
        body: lastMsg.body,
        createdAt: lastMsg.createdAt.toISOString(),
      },
      unreadCount,
      updatedAt: lastMsg.createdAt,
    });
  }

  const memberships = await prisma.chatGroupMember.findMany({
    where: { userId },
    include: {
      group: { select: { id: true, name: true, createdAt: true } },
    },
  });

  for (const m of memberships) {
    const { groupId } = m;
    const lastMsg = await prisma.chatGroupMessage.findFirst({
      where: { groupId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        groupId: true,
        senderId: true,
        body: true,
        createdAt: true,
      },
    });
    const lastRead = m.lastReadAt;
    const unreadCount = await prisma.chatGroupMessage.count({
      where: {
        groupId,
        senderId: { not: userId },
        ...(lastRead ? { createdAt: { gt: lastRead } } : {}),
      },
    });
    const updatedAt = lastMsg?.createdAt ?? m.group.createdAt;
    items.push({
      kind: "group",
      groupId,
      name: m.group.name,
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            groupId: lastMsg.groupId,
            senderId: lastMsg.senderId,
            body: lastMsg.body,
            createdAt: lastMsg.createdAt.toISOString(),
          }
        : null,
      unreadCount,
      updatedAt,
    });
  }

  items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return items.map((it) => {
    if (it.kind === "direct") {
      return {
        kind: "direct",
        peerUserId: it.peerUserId,
        peer: it.peer,
        lastMessage: it.lastMessage,
        unreadCount: it.unreadCount,
      };
    }
    return {
      kind: "group",
      groupId: it.groupId,
      name: it.name,
      lastMessage: it.lastMessage,
      unreadCount: it.unreadCount,
    };
  });
}

export {
  createChatGroup,
  createChatMessage,
  createGroupMessage,
  listChatMessagesBetween,
  listConversationsForUser,
  listGroupMessages,
  markDirectThreadRead,
  markGroupThreadRead,
};
