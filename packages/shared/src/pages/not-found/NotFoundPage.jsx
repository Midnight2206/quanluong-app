import Link from "next/link";
import { Home } from "lucide-react";
import { UnifiedPageScrollRoot } from "@/hocs/withUnifiedPageScroll";
import { cn } from "@/utils/cn";

const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition border border-primary/20 bg-primary text-primary-foreground shadow-md shadow-primary/15 hover:brightness-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";

export function NotFoundPage() {
  return (
    <div
      data-page-scroll-owner="true"
      className="page-shell overflow-y-auto overscroll-y-contain"
    >
      <UnifiedPageScrollRoot className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="max-w-lg space-y-4 rounded-[1.75rem] border bg-card/90 p-8 text-center shadow-float">
          <p className="text-sm uppercase tracking-[0.28em] text-muted-foreground">
            404
          </p>
          <h1 className="text-3xl font-semibold">Không tìm thấy trang</h1>
          <p className="text-sm text-muted-foreground">
            Đường dẫn này chưa được khai báo hoặc đã được chuyển đi.
          </p>
          <Link href="/" className={cn(primaryBtn)}>
            <Home className="size-4 shrink-0" aria-hidden />
            <span>Quay về dashboard</span>
          </Link>
        </div>
      </UnifiedPageScrollRoot>
    </div>
  );
}
