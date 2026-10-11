"use client";

import { AuthLayout } from "@/layouts/AuthLayout";
import { PublicOnlyRoute } from "@/hocs/PublicOnlyRoute";

export default function LoginGuardLayout({ children }) {
  return (
    <AuthLayout>
      <PublicOnlyRoute>{children}</PublicOnlyRoute>
    </AuthLayout>
  );
}
