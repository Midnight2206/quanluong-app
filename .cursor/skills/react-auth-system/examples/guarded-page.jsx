import { ProtectedRoute } from "../templates/protected-route";
import { useAuthStore } from "../templates/auth-store";

export const UsersManagementPage = () => {
  return (
    <ProtectedRoute
      requiredPermission="users.read"
      useAuthStore={useAuthStore}
      unauthorizedFallback={<p>You do not have permission to view users.</p>}
    >
      <section>
        <h1>Users</h1>
      </section>
    </ProtectedRoute>
  );
};
