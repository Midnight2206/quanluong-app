export const filterRoutesByPermission = ({
  routes,
  hasPermission,
}) => {
  return routes.filter((route) => {
    if (!route.requiredPermission) {
      return true;
    }

    return hasPermission(route.requiredPermission);
  });
};
