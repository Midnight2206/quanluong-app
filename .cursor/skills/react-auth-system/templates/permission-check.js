export const hasRole = (user, role) => {
  return Boolean(user?.roles?.includes(role));
};

export const hasPermission = (user, permission) => {
  return Boolean(user?.permissions?.includes(permission));
};

export const hasAnyPermission = (user, permissions = []) => {
  return permissions.some((permission) => hasPermission(user, permission));
};
