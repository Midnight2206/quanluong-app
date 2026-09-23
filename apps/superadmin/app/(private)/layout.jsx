"use client";

import { Suspense } from "react";
import { PrivateRoute } from "@/hocs/PrivateRoute";
import { ClientPersistenceProvider } from "@/lib/clientPersist/ClientPersistenceProvider.jsx";
import { SuperadminOnlyRoute } from "@/hocs/SuperadminOnlyRoute";
import { MainLayout } from "@/layouts/MainLayout";
import { superadminPortalNavItems } from "@/features/navigation/navConfig";

export default function PrivateGroupLayout({ children }) {
  return (
    <Suspense fallback={null}>
      <PrivateRoute>
        <SuperadminOnlyRoute>
          <ClientPersistenceProvider>
            <MainLayout navItems={superadminPortalNavItems} showWorkingUnitScope={false}>
              {children}
            </MainLayout>
          </ClientPersistenceProvider>
        </SuperadminOnlyRoute>
      </PrivateRoute>
    </Suspense>
  );
}
