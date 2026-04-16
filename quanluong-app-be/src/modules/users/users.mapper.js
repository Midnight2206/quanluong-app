function mapUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    isActive: user.isActive,
    registrationStatus: user.registrationStatus,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
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
    jobTitle: user.jobTitle
      ? {
          id: user.jobTitle.id,
          name: user.jobTitle.name,
          unitId: user.jobTitle.unitId,
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
  };
}

export { mapUser };
