"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings, UserRound } from "lucide-react";
import { useLogoutWithDraftGuard } from "@/features/auth/hooks/useLogoutWithDraftGuard";
import { useLocalUnsavedFieldMarks } from "@/hooks/useLocalUnsavedFieldMarks";
import { usePrivateDomUiPersist } from "@/hooks/usePrivateDomUiPersist";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import { supplierNavItems } from "@/features/navigation/navConfig";
import { AppSidebar } from "@/layouts/components/AppSidebar";
import { ThemePicker } from "@/components/common/ThemeToggle";
import { UnifiedPageScrollRoot } from "@/hocs/withUnifiedPageScroll";
import { cn } from "@/utils/cn";
import { SUPPLIER_DEFAULT_HOME, supplierPath } from "@/utils/supplierPortal";

/**
 * Shell NCC legacy (apps/supplier). App chính dùng MainLayout + supplierNavItems.
 */
export function SupplierShell({ children }) {
  const router = useRouter();
  const user = useCurrentUser();
  const { logoutWithDraftGuard, isLoggingOut } = useLogoutWithDraftGuard();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);

  usePrivateDomUiPersist();
  useLocalUnsavedFieldMarks();

  useEffect(() => {
    function onPointerDown(event) {
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const displayName = user?.profile?.fullName || user?.username || "Nhà cung cấp";

  async function handleLogout() {
    const ok = await logoutWithDraftGuard();
    setAccountOpen(false);
    if (ok) {
      router.refresh();
    }
  }

  return (
    <div className="page-shell flex min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="relative z-40 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3 sm:h-14 sm:px-4">
        <Link
          href={SUPPLIER_DEFAULT_HOME}
          className="min-w-0 shrink truncate text-sm font-semibold tracking-tight"
        >
          Cổng nhà cung cấp
        </Link>

        <div className="relative ml-auto flex items-center gap-2" ref={accountRef}>
          <ThemePicker variant="popover" />
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-background px-2 text-sm transition-colors duration-150 hover:border-primary/40"
            aria-expanded={accountOpen}
            aria-haspopup="menu"
            onClick={() => setAccountOpen((open) => !open)}
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <UserRound className="size-4" aria-hidden />
            </span>
            <span className="hidden max-w-40 truncate pr-1 sm:inline">{displayName}</span>
          </button>
          <div
            role="menu"
            className={cn(
              "absolute right-0 top-full z-50 mt-2 w-64 origin-top-right rounded-xl border border-border bg-card p-2 shadow-lg transition duration-200 ease-out",
              accountOpen
                ? "pointer-events-auto translate-y-0 opacity-100"
                : "pointer-events-none -translate-y-1 opacity-0",
            )}
          >
            <p className="truncate px-3 py-2 text-sm font-medium">{displayName}</p>
            <p className="px-3 pb-2 text-[11px] text-muted-foreground">Nhà cung cấp LTTP</p>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm hover:bg-secondary"
              onClick={() => {
                setAccountOpen(false);
                router.push(supplierPath("settings"));
              }}
            >
              <Settings className="size-4 text-muted-foreground" aria-hidden />
              Cài đặt
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm hover:bg-secondary"
              onClick={() => {
                setAccountOpen(false);
                router.push(supplierPath("profile"));
              }}
            >
              <UserRound className="size-4 text-muted-foreground" aria-hidden />
              Trang cá nhân
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-destructive hover:bg-secondary"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              <LogOut className="size-4" aria-hidden />
              {isLoggingOut ? "Đang xử lý…" : "Đăng xuất"}
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AppSidebar items={supplierNavItems} />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 pt-3 pb-[max(0.75rem,calc(4.25rem+env(safe-area-inset-bottom,0px)))] sm:px-4 sm:pt-4 sm:pb-[max(1rem,calc(4.25rem+env(safe-area-inset-bottom,0px)))] lg:px-3 lg:py-2 lg:pb-2">
          <div
            data-page-scroll-owner="true"
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch] touch-pan-y"
          >
            <UnifiedPageScrollRoot className="min-h-full">{children}</UnifiedPageScrollRoot>
          </div>
        </main>
      </div>
    </div>
  );
}
