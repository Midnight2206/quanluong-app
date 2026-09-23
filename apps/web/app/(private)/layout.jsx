"use client";

import { Suspense } from "react";
import { PrivateRoute } from "@/hocs/PrivateRoute";
import { ClientPersistenceProvider } from "@/lib/clientPersist/ClientPersistenceProvider.jsx";
import { OfflineProvider } from "@/offline/OfflineProvider.jsx";
import { MainLayout } from "@/layouts/MainLayout";

export default function PrivateGroupLayout({ children }) {
  return (
    <Suspense fallback={null}>
      <PrivateRoute>
        <ClientPersistenceProvider>
          <OfflineProvider>
            <MainLayout>{children}</MainLayout>
          </OfflineProvider>
        </ClientPersistenceProvider>
      </PrivateRoute>
    </Suspense>
  );
}
