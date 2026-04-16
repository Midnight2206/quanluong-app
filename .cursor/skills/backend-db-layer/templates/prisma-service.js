import { prisma } from "./prisma-client";

export const makeUsersService = () => ({
  async list() {
    return prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });
  },

  async create(input) {
    return prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
      },
    });
  },
});
