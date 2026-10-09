"use client";

import { Suspense } from "react";
import { SupplierOnlyRoute } from "@/hocs/SupplierOnlyRoute";
import { ClientPersistenceProvider } from "@/lib/clientPersist/ClientPersistenceProvider.jsx";
import { OfflineProvider } from "@/offline/OfflineProvider.jsx";
import { SupplierShell } from "@/pages/lttp-supplier/SupplierShell";

export default function PrivateGroupLayout({ children }) {
  return (
    <Suspense fallback={null}>
      <SupplierOnlyRoute>
        <ClientPersistenceProvider>
          <OfflineProvider>
            <SupplierShell>{children}</SupplierShell>
          </OfflineProvider>
        </ClientPersistenceProvider>
      </SupplierOnlyRoute>
    </Suspense>
  );
}
