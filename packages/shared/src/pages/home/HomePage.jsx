"use client";

import Link from "next/link";
import { ClientRedirect } from "@/hocs/ClientRedirect";
import { useAuthInitialized, useCurrentUser, useIsAuthenticated } from "@/features/auth/model/authSlice";
import { isSuperadminUser } from "@/utils/postLoginPath";
import { getMainAppOrigin } from "@/utils/superadminPortal";

/**
 * Trang chủ trong shell đã đăng nhập (cổng superadmin, `(main)/`).
 * Không phải landing marketing của app chính.
 *
 * Superadmin được vào `/dashboard` của cổng này (layout đó giữ họ lại).
 * Tài khoản khác không được đẩy vào `/dashboard`: layout dashboard gửi họ về
 * đúng trang này → vòng lặp `/` ↔ `/dashboard`.
 */
export function HomePage() {
  const isAuthenticated = useIsAuthenticated();
  const user = useCurrentUser();
  const initialized = useAuthInitialized();

  if (!initialized) {
    return <p className="text-sm text-muted-foreground">Đang tải…</p>;
  }

  if (isAuthenticated && isSuperadminUser(user)) {
    return <ClientRedirect href="/dashboard" replace />;
  }

  if (!isAuthenticated) {
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

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Trang làm việc</h1>
      <p className="text-sm text-muted-foreground">
        Bảng điều khiển hệ thống chỉ mở cho tài khoản superadmin. Tài khoản đơn vị dùng ứng dụng chính.
      </p>
      <a
        href={`${getMainAppOrigin()}/dashboard`}
        className="inline-flex w-fit rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Mở ứng dụng chính
      </a>
    </div>
  );
}
