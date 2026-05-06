function mapPermission(permission) {
  return {
    id: permission.id,
    code: permission.code,
    name: permission.name,
    description: permission.description,
    method: permission.method,
    module: permission.module,
    pathRoute: permission.pathRoute,
  };
}

function mapCurrentUser(user, { unitPath } = {}) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    isActive: user.isActive,
    emailVerified: Boolean(user.emailVerifiedAt),
    googleDriveFolderId: user.googleDriveFolderId || null,
    entertainmentCoins: user.entertainmentCoins,
    entertainmentHeadsCount: user.entertainmentHeadsCount,
    entertainmentTailsCount: user.entertainmentTailsCount,
    registrationStatus: user.registrationStatus,
    unitPath: unitPath ?? [],
    jobTitle: user.jobTitle
      ? {
          id: user.jobTitle.id,
          name: user.jobTitle.name,
          unitId: user.jobTitle.unitId,
        }
      : null,
    type: user.type
      ? {
          id: user.type.id,
          name: user.type.name,
          description: user.type.description,
        }
      : null,
    unit: user.unit
      ? {
          id: user.unit.id,
          name: user.unit.name,
          description: user.unit.description,
        }
      : null,
    assignedUnit: user.assignedUnit
      ? {
          id: user.assignedUnit.id,
          name: user.assignedUnit.name,
          description: user.assignedUnit.description,
        }
      : null,
    profile: user.profile
      ? {
          id: user.profile.id,
          fullName: user.profile.fullName,
          birthday: user.profile.birthday,
          avatarUrl: user.profile.avatarUrl,
          description: user.profile.description,
          jobTitle: user.profile.jobTitle,
          rank: user.profile.rank,
          phoneNumber: user.profile.phoneNumber,
          address: user.profile.address,
        }
      : null,
    permissions: (user.permissions || []).map(mapPermission),
  };
}

function mapAuthPayload(user) {
  return {
    sub: String(user.id),
    username: user.username,
    email: user.email,
    typeName: user.type?.name || null,
    permissions: (user.permissions || []).map((permission) => permission.code),
  };
}

export { mapAuthPayload, mapCurrentUser };
