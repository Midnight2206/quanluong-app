import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Cài đặt",
  description: "Chuyển hướng tới trang hồ sơ nơi tập trung tuỳ chọn tài khoản.",
});

export default function SettingsSegmentLayout({ children }) {
  return children;
}
