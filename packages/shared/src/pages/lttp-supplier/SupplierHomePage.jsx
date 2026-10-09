import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";

export function SupplierHomePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 py-6 sm:px-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">LTTP</p>
        <h1 className="text-2xl font-semibold text-foreground">Cổng nhà cung cấp</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Đây là cổng xem đặt hàng dành cho nhà cung cấp lương thực, thực phẩm.
          Superadmin gắn tài khoản với nhà cung cấp đã có ở đơn vị cấp 1.
          Mỗi lần xem là một cặp đơn vị cấp 1 và nhà cung cấp.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 !p-4">
            <h2 className="text-sm font-semibold">Xem đặt hàng</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Chọn ngày, chọn đơn vị nhận, rồi xem bảng đặt hàng trong ngày.
              Nút Xem bằng chữ mở cửa sổ chữ. Máy tính có thêm nút tải ảnh của bảng.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 !p-4">
            <h2 className="text-sm font-semibold">Tài khoản</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Menu góc phải mở cài đặt giao diện, trang cá nhân và đăng xuất.
              Chế độ sáng tối dùng chung với hệ thống.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/dat-hang"
          className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Vào đặt hàng
        </Link>
        <Link
          href="/so-cong-no"
          className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground"
        >
          Sổ công nợ
        </Link>
      </div>
    </div>
  );
}
