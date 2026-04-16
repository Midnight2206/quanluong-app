"use client";

import { Suspense } from "react";
import { PrivateRoute } from "@/hocs/PrivateRoute";
import { SuperadminOnlyRoute } from "@/hocs/SuperadminOnlyRoute";
import { MainLayout } from "@/layouts/MainLayout";
import { superadminPortalNavItems } from "@/features/navigation/navConfig";

export default function PrivateGroupLayout({ children }) {
  return (
    <Suspense fallback={null}>
      <PrivateRoute>
        <SuperadminOnlyRoute>
          <MainLayout navItems={superadminPortalNavItems}>{children}</MainLayout>
        </SuperadminOnlyRoute>
      </PrivateRoute>
    </Suspense>
  );
}
