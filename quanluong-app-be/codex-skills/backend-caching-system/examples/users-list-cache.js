import { prisma } from "../../backend-db-layer/templates/prisma-client.js";
import { getOrSetCache } from "../templates/cache-aside.js";
import { deleteKeys } from "../templates/redis-cache.js";
import { buildUsersListKey, buildUserDetailKey } from "../templates/cache-keys.js";

async function listUsers({ page, limit, sort }) {
  const key = buildUsersListKey({ page, limit, sort });

  return getOrSetCache({
    key,
    ttlSeconds: 60,
    loader: async () => {
      return prisma.user.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          createdAt: sort === "createdAt_desc" ? "desc" : "asc",
        },
        where: {
          deletedAt: null,
        },
      });
    },
  });
}

async function updateUser(userId, data) {
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data,
  });

  await deleteKeys([
    buildUserDetailKey(userId),
  ]);

  return updatedUser;
}

export { listUsers, updateUser };
