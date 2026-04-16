import { Navigate, useLocation } from "react-router-dom";

export const ProtectedRoute = ({
  children,
  authStatus,
  hasAccess,
  loadingFallback = <p>Checking access...</p>,
  unauthorizedFallback = <p>You do not have permission to view this page.</p>,
}) => {
  const location = useLocation();

  if (authStatus === "unknown" || authStatus === "loading") {
    return loadingFallback;
  }

  if (authStatus !== "authenticated") {
    return (
      <Navigate
        replace
        state={{ from: location }}
        to="/login"
      />
    );
  }

  if (!hasAccess) {
    return unauthorizedFallback;
  }

  return children;
};
