"use client";

import { Suspense } from "react";
import { PrivateRoute } from "@/hocs/PrivateRoute";
import { SupplierOnlyRoute } from "@/hocs/SupplierOnlyRoute";

export default function PrivateGroupLayout({ children }) {
  return (
    <Suspense fallback={null}>
      <PrivateRoute>
        <SupplierOnlyRoute>{children}</SupplierOnlyRoute>
      </PrivateRoute>
    </Suspense>
  );
}
