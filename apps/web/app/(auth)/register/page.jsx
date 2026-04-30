import { fetchRegisterUnitsForServer } from "@quanluong/shared/server-data/register-units";
import { RegisterPage } from "@/pages/register/RegisterPage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Đăng ký",
  description:
    "Tạo tài khoản Quân lương và chọn đơn vị; sau đó xác minh email nếu bật trên máy chủ.",
});

export default async function RegisterRoutePage() {
  const result = await fetchRegisterUnitsForServer();

  return (
    <RegisterPage initialUnits={result.units} initialUnitsError={!result.ok} />
  );
}
