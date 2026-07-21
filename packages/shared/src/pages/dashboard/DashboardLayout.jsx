"use client";

import { useEffect, useLayoutEffect, useMemo } from "react";
import { LayoutDashboard } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import { useRouteAccessByKey } from "@/features/route-access/routeAccessHooks";
import { ClientRedirect } from "@/hocs/ClientRedirect";
import { GuardedNavLink } from "@/hocs/GuardedNavLink";
import { ScrollableHorizontalStrip } from "@/components/common/ScrollableHorizontalStrip";
import { writePersistedNavTab } from "@/hooks/usePersistedNavTab";
import { DASHBOARD_TAB_META } from "@/pages/dashboard/dashboardTabMeta";
import { cn } from "@/utils/cn";
import { getSuperadminAppOrigin } from "@/utils/superadminPortal";

function RedirectToSuperadminPortal() {
  useLayoutEffect(() => {
    const o = getSuperadminAppOrigin();
    window.location.replace(`${o}${window.location.pathname}${window.location.search}`);
  }, []);
  return <p className="text-xs text-muted-foreground">Đang chuyển sang cổng quản trị hệ thống…</p>;
}

export function DashboardLayout({ children }) {
  const user = useCurrentUser();
  const byKey = useRouteAccessByKey();
  const pathname = usePathname();

  const tabMeta = DASHBOARD_TAB_META;

  useEffect(() => {
    const match = pathname.match(/^\/dashboard\/([^/]+)/);
    if (match?.[1]) {
      writePersistedNavTab("dashboard.primary", match[1]);
    }
  }, [pathname]);

  const visibleTabs = useMemo(
    () =>
      tabMeta.filter((tab) => {
        const key = tab.routeAccessKey;
        if (!key) {
          return true;
        }
        return byKey[key] !== "forbidden";
      }),
    [byKey, tabMeta],
  );

  if (!user) {
    return <ClientRedirect href="/login" replace />;
  }

  if (user.type?.name === "superadmin") {
    return <RedirectToSuperadminPortal />;
  }

  return (
    <div className="min-w-0 space-y-3 pb-6">
      <div data-sticky-level="0" className="unified-sticky-surface space-y-2">
        <header className="flex flex-wrap items-end justify-between gap-2 border-b border-border/60 pb-2">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Bảng điều khiển</p>
            <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
              <LayoutDashboard className="h-5 w-5 text-primary" aria-hidden />
              Theo quyền được cấp
            </h1>
          </div>
        </header>

        <ScrollableHorizontalStrip
          role="tablist"
          aria-label="Mục bảng điều khiển"
          className="border-b border-border bg-background/80 pb-px backdrop-blur-sm"
          innerClassName="flex flex-nowrap gap-0.5"
        >
          {visibleTabs.map((tab) => {
            const href = tab.nestedUnder === "lttp" ? "/dashboard/lttp" : `/dashboard/${tab.path}`;
            const useEnd = tab.nestedUnder !== "lttp";
            return (
              <GuardedNavLink
                key={tab.path}
                routeAccessKey={tab.routeAccessKey}
                href={href}
                end={useEnd}
                role="tab"
                className={({ isActive }) =>
                  cn(
                    "relative shrink-0 whitespace-nowrap rounded-t-md px-2.5 py-2.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-9 sm:text-sm sm:px-3",
                    isActive
                      ? "text-foreground after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                {tab.label}
              </GuardedNavLink>
            );
          })}
        </ScrollableHorizontalStrip>
      </div>

      <div role="tabpanel" className="min-w-0">
        {children}
      </div>
    </div>
  );
}
