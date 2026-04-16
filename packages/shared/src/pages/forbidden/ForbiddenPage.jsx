import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { cn } from "@/utils/cn";

const linkBtn =
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Hiển thị khi người dùng mở route không đủ quyền (guard phía client theo phiên đăng nhập).
 */
export function ForbiddenPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <ShieldOff className="h-7 w-7" aria-hidden />
      </div>
      <div className="max-w-md space-y-2">
        <h1 className="text-lg font-semibold tracking-tight">Không có quyền truy cập</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Tài khoản của bạn không có quyền mở tài nguyên này. Nếu cần thao tác tại đây, hãy liên hệ quản trị để được cấp
          quyền phù hợp.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/"
          className={cn(linkBtn, "border border-border/60 bg-background text-foreground hover:bg-muted/80")}
        >
          Về trang chủ
        </Link>
        <Link
          href="/dashboard"
          className={cn(
            linkBtn,
            "border border-primary/20 bg-primary text-primary-foreground shadow-md hover:brightness-[1.06]",
          )}
        >
          Bảng điều khiển
        </Link>
      </div>
    </div>
  );
}
