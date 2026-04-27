"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Building2, Users } from "lucide-react";
import { startNavigationIntent } from "@/components/navigation/navigationIntentStore";
import { UnitPathBreadcrumb } from "@/components/common/UnitPathBreadcrumb";
import { Card, CardContent } from "@/components/ui/Card";
import { useCurrentUser, useHasPermission } from "@/features/auth/model/authSlice";
import { DASHBOARD_LTTP_SUB_ACCESS_KEY } from "@/features/route-access/routeAccessRegistry";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import {
  readPersistedNavTab,
  readRawPersistedNavTab,
  useSyncPersistedNavTabFromRoute,
} from "@/hooks/usePersistedNavTab";
import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { AdminJobTitlesPanel } from "@/pages/dashboard/admin/AdminJobTitlesPanel";
import { AdminUnitDataSharePanel } from "@/pages/dashboard/admin/AdminUnitDataSharePanel";
import { AdminLttpPanel } from "@/pages/dashboard/admin/AdminLttpPanel";
import { AdminPendingRegistrationsPanel } from "@/pages/dashboard/admin/AdminPendingRegistrationsPanel";
import { SuperadminPermissionMatrixPanel } from "@/pages/dashboard/superadmin/SuperadminPermissionMatrixPanel";
import { SuperadminUnitsPanel } from "@/pages/dashboard/superadmin/SuperadminUnitsPanel";
import { SuperadminMealAllowanceRatesPanel } from "@/pages/dashboard/superadmin/SuperadminMealAllowanceRatesPanel";
import { SuperadminUsersPanel } from "@/pages/dashboard/superadmin/SuperadminUsersPanel";
import { cn } from "@/utils/cn";
import { DASHBOARD_LTTP_SUB_PATHS } from "@/pages/dashboard/dashboardTabMeta";

const dashboardCard = "space-y-2 !p-3 sm:!p-4";
const linkCardClass =
  "flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition hover:bg-secondary sm:text-sm";

const LTTP_SUB_ORDER = [
  "food-groups",
  "commodities",
  "suppliers",
  "tables",
  "effective",
  "newtable",
  "import",
];

/** Khôi phục tab dashboard cấp 1 đã lưu (mặc định «units»). */
export function DashboardIndexRedirect() {
  const router = useRouter();

  useEffect(() => {
    const raw = readRawPersistedNavTab("dashboard.primary");
    const isValid = raw && /^[a-z0-9-]+$/.test(raw) && raw.length <= 64;
    // Vào `/dashboard` gốc: không khôi phục thẳng tab «Bảng giá LTTP» (lttp) — tránh nhầm với màn Nhập xuất LTTP trên menu.
    const safe = isValid && raw !== "lttp" ? raw : "units";
    startNavigationIntent();
    router.replace(`/dashboard/${safe}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- một lần khi mount; router không đưa vào deps
  }, []);

  return <p className="text-xs text-muted-foreground">Đang mở bảng điều khiển…</p>;
}

export function DashboardUnitsPage() {
  return <SuperadminUnitsPanel />;
}

export function DashboardUsersPage() {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-3">
      <Card className="shrink-0 shadow-soft">
        <CardContent className={cn(dashboardCard, "flex flex-row flex-wrap items-center gap-2")}>
          <Link href="/users" className={cn(linkCardClass, "w-fit")}>
            <Users className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>Mở trang Người dùng (toàn màn hình)</span>
          </Link>
        </CardContent>
      </Card>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <SuperadminUsersPanel />
      </div>
    </div>
  );
}

export function DashboardPendingRegistrationsPage() {
  return (
    <div className="flex min-h-[12rem] flex-1 flex-col overflow-hidden">
      <AdminPendingRegistrationsPanel />
    </div>
  );
}

export function DashboardJobTitlesPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col pb-1">
      <AdminJobTitlesPanel />
    </div>
  );
}

export function DashboardUnitDownstreamSyncPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col pb-1">
      <AdminUnitDataSharePanel />
    </div>
  );
}

export function DashboardLttpGroupsPage() {
  const user = useCurrentUser();
  return (
    <div className="min-w-0">
      <AdminLttpPanel user={user} groupsOnly />
    </div>
  );
}

export function DashboardReportsPage() {
  return (
    <Card className="shadow-soft">
      <CardContent className={cn(dashboardCard)}>
        <p className="text-xs font-medium sm:text-sm">Báo cáo (sắp có)</p>
        <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Nhập xuất, tồn và chỉ tiêu sau khi tích hợp báo cáo.
        </p>
      </CardContent>
    </Card>
  );
}

export function DashboardAnalyticsPage() {
  return (
    <Card className="shadow-soft">
      <CardContent className={cn(dashboardCard)}>
        <p className="text-xs font-medium sm:text-sm">Thống kê (sắp có)</p>
        <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Chỉ số đơn vị, tài khoản hoạt động khi backend sẵn sàng.
        </p>
      </CardContent>
    </Card>
  );
}

export function DashboardPermissionMatrixPage() {
  return <SuperadminPermissionMatrixPanel />;
}

export { DashboardPermissionDescriptionsRoute as DashboardPermissionDescriptionsPage } from "@/pages/dashboard/DashboardPermissionDescriptionsRoute";

export function DashboardMealAllowanceRatesPage() {
  return (
    <div className="min-w-0">
      <SuperadminMealAllowanceRatesPanel />
    </div>
  );
}

export function DashboardSettingsPage() {
  return (
    <Card className="shadow-soft">
      <CardContent className={cn(dashboardCard)}>
        <p className="text-xs font-medium sm:text-sm">Cấu hình hệ thống (sắp có)</p>
        <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Tham số hệ thống, nhật ký truy cập và công cụ vận hành.
        </p>
      </CardContent>
    </Card>
  );
}

export function DashboardLttpIndexRedirect() {
  const router = useRouter();
  const canManageLttpGroups = useHasPermission(PERMISSIONS.LTTP_GROUPS_MANAGE);
  const canCRead = useHasPermission(PERMISSIONS.LTTP_COMMODITIES_READ);
  const canPRead = useHasPermission(PERMISSIONS.LTTP_PRICES_READ);
  const canPWrite = useHasPermission(PERMISSIONS.LTTP_PRICES_WRITE);

  const allowedSubIds = useMemo(() => {
    const show = {
      "food-groups": canManageLttpGroups,
      commodities: canCRead,
      suppliers: canCRead,
      tables: canPRead,
      effective: canPRead,
      newtable: canPRead && canPWrite,
      import: canPRead && canPWrite,
    };
    return LTTP_SUB_ORDER.filter((id) => show[id]);
  }, [canManageLttpGroups, canCRead, canPRead, canPWrite]);

  const allowedKey = allowedSubIds.join("|");

  useEffect(() => {
    if (!allowedSubIds.length) {
      startNavigationIntent();
      router.replace("/dashboard/lttp/commodities");
      return;
    }
    const stored = readPersistedNavTab("dashboard.lttp.sub", allowedSubIds);
    const sub = stored ?? allowedSubIds[0];
    startNavigationIntent();
    router.replace(`/dashboard/lttp/${sub}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- bỏ qua router + allowedSubIds (đã gói bằng allowedKey)
  }, [allowedKey]);

  return <p className="text-xs text-muted-foreground">Đang mở tab LTTP…</p>;
}

export function DashboardLttpTabPage() {
  const params = useParams();
  const rawSub = params?.lttpSub;
  const lttpSub = Array.isArray(rawSub) ? rawSub[0] : rawSub;
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const user = useCurrentUser();
  const canPickLttpUnit = useHasPermission(PERMISSIONS.UNITS_READ);
  const subGuardKey = lttpSub ? DASHBOARD_LTTP_SUB_ACCESS_KEY[lttpSub] : null;

  useSyncPersistedNavTabFromRoute("dashboard.lttp.sub", DASHBOARD_LTTP_SUB_PATHS, lttpSub);

  const onSubNavigate = useCallback((id, opts) => {
    const path = `/dashboard/lttp/${id}`;
    const r = routerRef.current;
    startNavigationIntent();
    if (opts?.replace) {
      r.replace(path);
    } else {
      r.push(path);
    }
  }, []);

  if (!user) {
    return null;
  }

  return (
    <RouteApiGuard routeAccessKey={subGuardKey}>
      <div className="min-w-0">
        <AdminLttpPanel
          user={user}
          allowUnitPick={canPickLttpUnit}
          routeSub={lttpSub}
          onSubNavigate={onSubNavigate}
        />
      </div>
    </RouteApiGuard>
  );
}
