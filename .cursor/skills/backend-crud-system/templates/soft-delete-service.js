export const makeSoftDeleteService = ({ prisma, modelName }) => ({
  async softDelete({ id, actorId }) {
    return prisma[modelName].update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: actorId,
      },
    });
  },
});
