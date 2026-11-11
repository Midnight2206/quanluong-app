"use client";

import Link from "next/link";
import { ClientRedirect } from "@/hocs/ClientRedirect";
import { useAuthInitialized, useIsAuthenticated } from "@/features/auth/model/authSlice";

/**
 * Trang chủ shell app (superadmin / chỗ còn import HomePage).
 * Web guest landing nằm ở MidnightLandingPage + MarketingLayout.
 * User đã đăng nhập không ở lại đây — vào dashboard.
 */
export function HomePage() {
  const isAuthenticated = useIsAuthenticated();
  const initialized = useAuthInitialized();

  if (!initialized) {
    return <p className="text-sm text-muted-foreground">Đang tải…</p>;
  }

  if (isAuthenticated) {
    return <ClientRedirect href="/dashboard" replace />;
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Quân lương</h1>
      <p className="text-sm text-muted-foreground">Đăng nhập để vào bảng điều khiển.</p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/login"
          className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Đăng nhập
        </Link>
        <Link
          href="/register"
          className="inline-flex rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium"
        >
          Đăng ký
        </Link>
      </div>
    </div>
  );
}
