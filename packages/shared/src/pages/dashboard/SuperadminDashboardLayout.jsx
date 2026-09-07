"use client";

import { useEffect } from "react";
import { LayoutDashboard } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import { ClientRedirect } from "@/hocs/ClientRedirect";
import { writePersistedNavTab } from "@/hooks/usePersistedNavTab";

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

  if (user.type?.name !== "superadmin") {
    return <ClientRedirect href="/" replace />;
  }

  return (
    <div className="min-w-0 space-y-3 pb-6">
      <div data-sticky-level="0" className="unified-sticky-surface space-y-2">
        <header className="flex flex-wrap items-end justify-between gap-2 border-b border-border/60 pb-2">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Bảng điều khiển</p>
            <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
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
