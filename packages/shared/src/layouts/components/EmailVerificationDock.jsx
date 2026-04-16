"use client";

import { AlertTriangle, Mail, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useCurrentUser, useIsAuthenticated } from "@/features/auth/model/authSlice";
import { cn } from "@/utils/cn";

function collapsedStorageKey(userId) {
  return `quanluong:emailVerifyDock:collapsed:${userId}`;
}

export function EmailVerificationDock() {
  const user = useCurrentUser();
  const isAuthenticated = useIsAuthenticated();
  const needsVerify = isAuthenticated && user?.emailVerified === false;
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!user?.id || !needsVerify) {
      return;
    }
    setCollapsed(localStorage.getItem(collapsedStorageKey(user.id)) === "1");
  }, [user?.id, needsVerify]);

  const setCollapsedPersist = useCallback((next, userId) => {
    setCollapsed(next);
    if (typeof window === "undefined" || !userId) {
      return;
    }
    if (next) {
      localStorage.setItem(collapsedStorageKey(userId), "1");
    } else {
      localStorage.removeItem(collapsedStorageKey(userId));
    }
  }, []);

  if (!needsVerify) {
    return null;
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsedPersist(false, user.id)}
        className={cn(
          "fixed bottom-4 right-4 z-[100] flex max-w-[min(calc(100vw-2rem),20rem)] items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-left text-xs font-medium text-amber-950 shadow-lg backdrop-blur-sm transition",
          "hover:bg-amber-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60",
          "dark:border-amber-400/35 dark:bg-amber-500/20 dark:text-amber-100 dark:hover:bg-amber-500/30",
        )}
        aria-expanded={false}
      >
        <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
        <span className="leading-snug">Email chưa xác minh — nhấn để xem</span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "shrink-0 border-t border-amber-500/35 bg-amber-500/[0.12] px-3 py-3 sm:px-4",
        "dark:border-amber-400/30 dark:bg-amber-500/15",
      )}
      role="region"
      aria-label="Nhắc xác minh email"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/25 text-amber-800 dark:text-amber-100">
            <Mail className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1 pr-8 sm:pr-0">
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-50">Tài khoản chưa xác minh email</p>
            <p className="text-xs leading-relaxed text-amber-900/85 dark:text-amber-100/85">
              Kiểm tra hộp thư <span className="font-medium">{user.email}</span> (kể cả thư mục spam) và bấm liên kết
              trong email đăng ký. Sau khi xác minh có thể dùng đầy đủ tính năng, gồm liên kết Google Drive.
            </p>
            <Link
              href="/verify-email/resend"
              className={cn(
                "inline-flex w-fit items-center justify-center rounded-lg border border-amber-800/35 bg-amber-500/90 px-3 py-2 text-xs font-semibold text-amber-950 shadow-sm transition",
                "hover:bg-amber-400/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60",
                "dark:border-amber-200/30 dark:bg-amber-500/85 dark:text-amber-950 dark:hover:bg-amber-400/80",
              )}
            >
              Gửi lại email xác minh
            </Link>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:self-center">
          <button
            type="button"
            onClick={() => setCollapsedPersist(true, user.id)}
            className={cn(
              "inline-flex items-center justify-center rounded-lg border border-amber-700/30 bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground transition",
              "hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50",
              "dark:border-amber-300/25 dark:bg-background/80",
            )}
          >
            Thu gọn
          </button>
          <button
            type="button"
            onClick={() => setCollapsedPersist(true, user.id)}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-lg text-amber-900/70 transition hover:bg-amber-500/20",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 dark:text-amber-100/70",
            )}
            aria-label="Đóng và thu gọn"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
