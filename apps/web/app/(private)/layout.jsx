"use client";

import { Suspense } from "react";
import { PrivateRoute } from "@/hocs/PrivateRoute";
import { MainLayout } from "@/layouts/MainLayout";

export default function PrivateGroupLayout({ children }) {
  return (
    <Suspense fallback={null}>
      <PrivateRoute>
        <MainLayout>{children}</MainLayout>
      </PrivateRoute>
    </Suspense>
  );
}
