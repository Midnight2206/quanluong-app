import { ProfilePage } from "@/pages/profile/ProfilePage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Hồ sơ",
  description: "Thông tin tài khoản, họ tên và ảnh đại diện của bạn trong Quân lương.",
});

export default function ProfileRoutePage() {
  return <ProfilePage />;
}
