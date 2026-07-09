"use client";

import { AlertTriangle, Mail, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useCurrentUser, useIsAuthenticated } from "@/features/auth/model/authSlice";
import { cn } from "@/utils/cn";

function collapsedStorageKey(userId) {
  return `quanluong:emailVerifyDock:collapsed:${userId}`;
}

function prefersCollapsedByViewport() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(max-width: 639px)").matches;
}

export function EmailVerificationDock() {
  const user = useCurrentUser();
  const isAuthenticated = useIsAuthenticated();
  const needsVerify = isAuthenticated && user?.emailVerified === false;
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (!user?.id || !needsVerify) {
      return;
    }
    const stored = localStorage.getItem(collapsedStorageKey(user.id));
    if (stored === "0") {
      setCollapsed(false);
      return;
    }
    if (stored === "1") {
      setCollapsed(true);
      return;
    }
    setCollapsed(prefersCollapsedByViewport());
  }, [user?.id, needsVerify]);

  const setCollapsedPersist = useCallback((next, userId) => {
    setCollapsed(next);
    if (typeof window === "undefined" || !userId) {
      return;
    }
    localStorage.setItem(collapsedStorageKey(userId), next ? "1" : "0");
  }, []);

  if (!needsVerify) {
    return null;
  }

  const bottomOffset =
    "bottom-[max(1rem,calc(4.25rem+env(safe-area-inset-bottom,0px)))] sm:bottom-4";

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsedPersist(false, user.id)}
        className={cn(
          "fixed right-4 z-[100] flex max-w-[min(calc(100vw-2rem),18rem)] items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-2.5 text-left text-xs font-medium text-amber-950 shadow-lg backdrop-blur-sm transition print:hidden",
          "hover:bg-amber-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60",
          "dark:border-amber-400/35 dark:bg-amber-500/20 dark:text-amber-100 dark:hover:bg-amber-500/30",
          bottomOffset,
        )}
        aria-expanded={false}
      >
        <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
        <span className="leading-snug">Email chưa xác minh</span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed inset-x-3 z-[100] rounded-xl border border-amber-500/35 bg-amber-500/[0.14] px-3 py-2.5 shadow-lg backdrop-blur-sm print:hidden sm:inset-x-auto sm:right-4 sm:max-w-md",
        bottomOffset,
        "dark:border-amber-400/30 dark:bg-amber-500/15",
      )}
      role="region"
      aria-label="Nhắc xác minh email"
    >
      <div className="flex items-start gap-2.5">
        <Mail className="mt-0.5 size-4 shrink-0 text-amber-800 dark:text-amber-200" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs font-semibold text-amber-950 dark:text-amber-50">Chưa xác minh email</p>
          <p className="text-xs text-amber-900/85 dark:text-amber-100/85">
            Kiểm tra hộp thư <span className="font-medium">{user.email}</span>.
          </p>
          <Link
            href="/verify-email/resend"
            className={cn(
              "inline-flex min-h-9 items-center justify-center rounded-lg border border-amber-800/35 bg-amber-500/90 px-3 py-1.5 text-xs font-semibold text-amber-950 transition",
              "hover:bg-amber-400/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60",
            )}
          >
            Gửi lại email
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setCollapsedPersist(true, user.id)}
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-amber-900/70 transition hover:bg-amber-500/20",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 dark:text-amber-100/70",
          )}
          aria-label="Thu gọn"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
