import { filterRoutesByPermission } from "../templates/filter-routes";

export const getVisibleNavRoutes = ({ routes, hasPermission }) => {
  return filterRoutesByPermission({
    routes: routes.filter((route) => route.showInNav !== false),
    hasPermission,
  });
};
