"use client";

import { useEffect } from "react";
import { LayoutDashboard } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import { ClientRedirect } from "@/hocs/ClientRedirect";
import { writePersistedNavTab } from "@/hooks/usePersistedNavTab";
import { isSuperadminUser } from "@/utils/postLoginPath";
import { getMainAppOrigin } from "@/utils/superadminPortal";

/**
 * Bảng điều khiển chỉ dành cho superadmin — dùng trên cổng superadmin.
 */
export function SuperadminDashboardLayout({ children }) {
  const user = useCurrentUser();
  const pathname = usePathname();

  useEffect(() => {
    const match = pathname.match(/^\/dashboard\/([^/]+)/);
    if (match?.[1]) {
      writePersistedNavTab("dashboard.primary", match[1]);
    }
  }, [pathname]);

  if (!user) {
    return <ClientRedirect href="/login" replace />;
  }

  if (!isSuperadminUser(user)) {
    // Không `ClientRedirect` về `/`: HomePage của shell đang đăng nhập lại đẩy mọi
    // user đã đăng nhập sang `/dashboard` → vòng lặp.
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold text-foreground">Bảng điều khiển hệ thống</h1>
        <p className="text-sm text-muted-foreground">
          Chỉ tài khoản superadmin dùng bảng này. Tài khoản đơn vị mở ứng dụng chính.
        </p>
        <a
          href={`${getMainAppOrigin()}/dashboard`}
          className="inline-flex justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Mở ứng dụng chính
        </a>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3 pb-6">
      <div data-sticky-level="0" className="unified-sticky-surface space-y-2">
        <header className="flex flex-wrap items-end justify-between gap-2 border-b border-border/60 pb-2">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bảng điều khiển</p>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <LayoutDashboard className="h-5 w-5 text-primary" aria-hidden />
              Quản lý hệ thống
            </h1>
          </div>
        </header>
      </div>

      <div className="min-w-0">
        {children}
      </div>
    </div>
  );
}
