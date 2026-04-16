const AUTH_ROUTE_DEFINITIONS = [
  {
    method: "GET",
    module: "auth",
    path: "/register-units",
    pathRoute: "/api/auth/register-units",
  },
  {
    method: "POST",
    module: "auth",
    path: "/register",
    pathRoute: "/api/auth/register",
  },
  {
    method: "POST",
    module: "auth",
    path: "/login",
    pathRoute: "/api/auth/login",
  },
  {
    method: "POST",
    module: "auth",
    path: "/refresh-token",
    pathRoute: "/api/auth/refresh-token",
  },
  {
    method: "GET",
    module: "auth",
    path: "/current-user",
    pathRoute: "/api/auth/current-user",
  },
  {
    method: "POST",
    module: "auth",
    path: "/logout",
    pathRoute: "/api/auth/logout",
  },
];

export { AUTH_ROUTE_DEFINITIONS };
