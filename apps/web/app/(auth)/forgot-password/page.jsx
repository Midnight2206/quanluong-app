import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Quên mật khẩu",
  description: "Nhập email để nhận liên kết đặt lại mật khẩu cho tài khoản Quân lương.",
});

export default function ForgotPasswordRoutePage() {
  return <ForgotPasswordPage />;
}
