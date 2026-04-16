import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { UsersPage } from "@/pages/users/UsersPage";

/**
 * Không fetch danh sách trên RSC: mỗi lần điều hướng tới /users, App Router không chờ
 * round-trip server + API; UsersPage dùng RTK Query (có cache) → chuyển trang nhẹ hơn.
 */
export default function UsersRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="nav-users">
      <UsersPage />
    </RouteApiGuard>
  );
}
