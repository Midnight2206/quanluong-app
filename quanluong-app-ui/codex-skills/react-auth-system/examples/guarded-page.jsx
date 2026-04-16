import { useSelector } from "react-redux";

import { ProtectedRoute } from "../templates/protected-route";

export const UsersManagementPage = () => {
  return (
    <ProtectedRoute
      requiredPermission="users.read"
      useSelector={useSelector}
      unauthorizedFallback={<p>You do not have permission to view users.</p>}
    >
      <section>
        <h1>Users</h1>
      </section>
    </ProtectedRoute>
  );
};
