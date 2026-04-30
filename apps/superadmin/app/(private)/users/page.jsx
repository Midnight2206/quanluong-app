import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { UsersPage } from "@/pages/users/UsersPage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Người dùng",
  description: "Quản trị người dùng và phân bổ theo đơn vị trong phạm vi quyền của bạn.",
});

export default function UsersRoutePage() {
  return (
    <RouteApiGuard routeAccessKey="nav-users">
      <UsersPage />
    </RouteApiGuard>
  );
}
