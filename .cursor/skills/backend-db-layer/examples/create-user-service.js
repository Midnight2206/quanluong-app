import { prisma } from "../templates/prisma-client";

export const makeUsersService = () => ({
  async create(input) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      const error = new Error("Email already exists.");
      error.code = "EMAIL_EXISTS";
      throw error;
    }

    return prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
      },
    });
  },
});
