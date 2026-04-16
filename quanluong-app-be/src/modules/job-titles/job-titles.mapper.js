function mapJobTitle(jobTitle) {
  if (!jobTitle) {
    return null;
  }

  return {
    id: jobTitle.id,
    unitId: jobTitle.unitId,
    name: jobTitle.name,
    description: jobTitle.description,
    isActive: jobTitle.isActive,
    createdAt: jobTitle.createdAt,
    updatedAt: jobTitle.updatedAt,
    permissionIds: jobTitle.permissions?.map((p) => p.permissionId) ?? undefined,
  };
}

export { mapJobTitle };
