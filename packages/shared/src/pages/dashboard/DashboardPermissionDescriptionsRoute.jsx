"use client";

import { RouteApiGuard } from "@/hocs/RouteApiGuard";
import { SuperadminPermissionDescriptionsPanel } from "@/pages/dashboard/superadmin/SuperadminPermissionDescriptionsPanel";

/** Route riêng (không import từ DashboardTabPages.jsx) để Next có một client manifest entry ổn định trong Docker/monorepo. */
export function DashboardPermissionDescriptionsRoute() {
  return (
    <RouteApiGuard routeAccessKey="dashboard-permission-descriptions">
      <div className="flex min-h-[12rem] flex-1 flex-col overflow-hidden">
        <SuperadminPermissionDescriptionsPanel />
      </div>
    </RouteApiGuard>
  );
}
