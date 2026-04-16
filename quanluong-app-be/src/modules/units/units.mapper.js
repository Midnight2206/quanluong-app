function mapUnit(unit) {
  if (!unit) {
    return null;
  }

  return {
    id: unit.id,
    parentId: unit.parentId,
    path: unit.path,
    depth: unit.depth,
    name: unit.name,
    description: unit.description,
    isActive: unit.isActive,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
    ...(unit._count
      ? {
          userCount: unit._count.users,
          childCount: unit._count.children,
        }
      : {}),
  };
}

export { mapUnit };
