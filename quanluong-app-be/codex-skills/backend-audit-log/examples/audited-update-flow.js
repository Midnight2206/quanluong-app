export const makeRolesService = ({ prisma, auditService }) => ({
  async assignPermission({ actorId, roleId, permissionId }) {
    return prisma.$transaction(async (tx) => {
      const assignment = await tx.rolePermission.create({
        data: {
          roleId,
          permissionId,
        },
      });

      await auditService.record(
        {
          action: "role.permission.assigned",
          actorId,
          entityType: "role",
          entityId: roleId,
          summary: "Assigned permission to role.",
          metadata: {
            permissionId,
          },
        },
        tx,
      );

      return assignment;
    });
  },
});
