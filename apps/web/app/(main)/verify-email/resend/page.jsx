import { ResendVerificationEmailPage } from "@/pages/verify-email/ResendVerificationEmailPage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Gửi lại email xác minh",
  description: "Yêu cầu máy chủ gửi lại thư xác minh địa chỉ email cho tài khoản của bạn.",
});

export default function ResendVerifyEmailRoutePage() {
  return <ResendVerificationEmailPage />;
}
