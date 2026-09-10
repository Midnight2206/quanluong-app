"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useAuthInitialized, useCurrentUser, useIsAuthenticated } from "@/features/auth/model/authSlice";
import { getMainAppOrigin } from "@/utils/superadminPortal";

export function SuperadminOnlyRoute({ children }) {
  const initialized = useAuthInitialized();
  const isAuthenticated = useIsAuthenticated();
  const user = useCurrentUser();

  useEffect(() => {
    if (initialized && !isAuthenticated) {
      // Đăng nhập trên app chính (cần COOKIE_DOMAIN chung), rồi quay lại cổng admin.
      window.location.replace(`${getMainAppOrigin()}/login?portal=admin`);
    }
  }, [initialized, isAuthenticated]);

  if (!initialized) {
    return null;
  }

  if (!isAuthenticated) {
    return <p className="text-sm text-muted-foreground">Chuyển tới trang đăng nhập…</p>;
  }

  if (user?.type?.name !== "superadmin") {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">Cổng quản trị hệ thống</h1>
        <p className="text-sm text-muted-foreground">
          Chỉ tài khoản superadmin đăng nhập tại địa chỉ này. Bạn có thể quay lại ứng dụng chính.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href="/login"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Đăng nhập tài khoản khác
          </Link>
          <a
            href={`${getMainAppOrigin()}/`}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:brightness-105"
          >
            Mở ứng dụng chính
          </a>
        </div>
      </div>
    );
  }

  return children;
}
