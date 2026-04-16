import { Navigate } from "react-router-dom";

import {
  selectAuthStatus,
  selectCurrentUser,
} from "./auth-store";
import { hasPermission } from "./permission-check";

export const ProtectedRoute = ({
  children,
  requiredPermission,
  useSelector,
  loadingFallback = <p>Checking access...</p>,
  unauthorizedFallback = <p>You do not have access to this area.</p>,
}) => {
  const status = useSelector(selectAuthStatus);
  const user = useSelector(selectCurrentUser);

  if (status === "unknown" || status === "loading") {
    return loadingFallback;
  }

  if (status !== "authenticated") {
    return <Navigate replace to="/login" />;
  }

  if (requiredPermission && !hasPermission(user, requiredPermission)) {
    return unauthorizedFallback;
  }

  return children;
};
