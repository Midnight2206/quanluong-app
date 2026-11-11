"use client";

import Link from "next/link";
import { AppBrand } from "@/components/common/AppBrand";
import { ThemePicker } from "@/components/common/ThemeToggle";
import { UnifiedPageScrollRoot } from "@/hocs/withUnifiedPageScroll";
import { cn } from "@/utils/cn";

const btnBase =
  "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Shell tối giản cho landing Midnight — theo theme (sáng/tối + accent), không sidebar / chat dock.
 */
export function MarketingLayout({ children }) {
  return (
    <div className="ql-landing page-shell flex min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="relative z-40 flex h-[4.25rem] shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 shadow-sm backdrop-blur-md sm:h-[4.5rem] sm:gap-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center">
          <Link href="/" className="min-w-0" aria-label="Midnight — trang chủ">
            <AppBrand compact logoOnly />
          </Link>
        </div>
        <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2" aria-label="Điều hướng landing">
          <ThemePicker variant="popover" />
          <Link
            href="/login"
            className={cn(
              btnBase,
              "border border-input bg-card text-foreground shadow-soft hover:border-primary/40 hover:bg-muted",
            )}
          >
            Đăng nhập
          </Link>
          <Link
            href="/register"
            className={cn(
              btnBase,
              "border border-primary bg-primary font-semibold text-primary-foreground shadow-soft hover:bg-primary/90",
            )}
          >
            Đăng ký
          </Link>
        </nav>
      </header>
      <div
        data-page-scroll-owner="true"
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch]"
      >
        <UnifiedPageScrollRoot className="min-h-full">{children}</UnifiedPageScrollRoot>
      </div>
    </div>
  );
}
