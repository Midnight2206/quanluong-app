import { Navigate, useLocation } from "react-router-dom";

export const PrivateRoute = ({
  children,
  authStatus,
  loadingFallback = <p>Checking session...</p>,
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

  return children;
};
