import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { UsersPage } from "@/pages/users/UsersPage";

export default function UsersRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="nav-users">
      <UsersPage />
    </RouteApiGuard>
  );
}
