export const makeUsersService = ({ prisma }) => ({
  async patchUser({ id, input }) {
    return prisma.user.update({
      where: { id },
      data: input,
    });
  },

  async putUser({ id, input }) {
    return prisma.user.update({
      where: { id },
      data: {
        fullName: input.fullName,
        email: input.email,
        status: input.status,
      },
    });
  },
});
