"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  LogIn,
  LogOut,
  MessageCircle,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startNavigationIntent } from "@/components/navigation/navigationIntentStore";
import { AppBrand } from "@/components/common/AppBrand";
import { Button } from "@/components/ui/Button";
import { useLogoutWithDraftGuard } from "@/features/auth/hooks/useLogoutWithDraftGuard";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import { cn } from "@/utils/cn";
import { resolveMediaUrl } from "@/utils/runtimeEnv";
import { ThemePicker } from "@/components/common/ThemeToggle";
import { useChatDockOptional } from "@/contexts/ChatDockContext";
import { useNetworkStatus } from "@/offline/hooks/useNetworkStatus.js";

export function AppHeader() {
  const router = useRouter();
  const user = useCurrentUser();
  const chatDock = useChatDockOptional();
  const { online } = useNetworkStatus();
  const { logoutWithDraftGuard, isLoggingOut } = useLogoutWithDraftGuard();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const displayName = user?.profile?.fullName || user?.username || "Khách";
  const avatarUrl = user?.profile?.avatarUrl ? resolveMediaUrl(user.profile.avatarUrl) : null;

  const handleLogout = async () => {
    try {
      await logoutWithDraftGuard();
    } finally {
      setIsMenuOpen(false);
    }
  };

  return (
    <header className="relative z-40 flex h-16 shrink-0 items-center gap-3 border-b bg-card px-4 print:hidden sm:px-5 lg:px-6">
      <div className="flex items-center min-w-0 gap-3">
        <AppBrand compact />
      </div>

      <div className="flex items-center gap-2 ml-auto sm:gap-3" ref={menuRef}>
        <button
          type="button"
          aria-label="Thông báo"
          className="inline-flex items-center justify-center w-10 h-10 transition-colors duration-150 rounded-full text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
        >
          <Bell className="w-5 h-5" aria-hidden />
        </button>
        {user && chatDock ? (
          <button
            type="button"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-secondary-foreground"
            title="Tin nhắn"
            aria-label="Mở tin nhắn"
            onClick={() => chatDock.setHubOpen(true)}
          >
            <MessageCircle className="h-5 w-5" aria-hidden />
            {chatDock.unreadChatTotal > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
                {chatDock.unreadChatTotal > 99 ? "99+" : chatDock.unreadChatTotal}
              </span>
            ) : null}
          </button>
        ) : null}
        {user ? (
          <button
            type="button"
            aria-label="Tài khoản"
            aria-haspopup="menu"
            className="flex items-center gap-2 px-1 py-1 pr-3 transition-colors duration-150 border rounded-full bg-background hover:border-primary/40"
            onClick={() => setIsMenuOpen((value) => !value)}
          >
            <div className="relative shrink-0">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-accent text-accent-foreground">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="w-5 h-5" />
                )}
              </div>
              {online ? (
                <span
                  className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
                  title="Đang online"
                  aria-label="Đang online"
                />
              ) : null}
            </div>
            <ChevronDown className="hidden w-4 h-4 text-muted-foreground sm:block" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors duration-150 border rounded-lg bg-background hover:border-primary/40"
            >
              <LogIn className="w-4 h-4" />
              Đăng nhập
            </Link>
            <Link
              href="/register"
              className="hidden px-4 py-2 text-sm font-medium transition-colors duration-150 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 sm:inline-flex"
            >
              Đăng ký
            </Link>
          </div>
        )}

        <div
          className={cn(
            "absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-card p-3 shadow-float transition duration-150",
            isMenuOpen && user
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-2 opacity-0",
          )}
        >
          <div className="flex items-center gap-3 pb-4 border-b">
            <div className="relative shrink-0">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-accent text-accent-foreground">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="h-7 w-7" />
                )}
              </div>
              {online ? (
                <span
                  className="absolute bottom-0.5 right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
                  title="Đang online"
                  aria-label="Đang online"
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold truncate">{displayName}</p>
              <p className="text-sm truncate text-muted-foreground">
                {user?.email || "@admin"}
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-1">
            <button
              type="button"
              className="flex items-center w-full gap-3 px-3 py-2.5 text-sm text-left transition-colors duration-150 rounded-md hover:bg-secondary"
              onClick={() => {
                setIsMenuOpen(false);
                startNavigationIntent();
                router.push("/profile");
              }}
            >
              <UserRound className="w-4 h-4 text-muted-foreground" />
              Trang cá nhân
            </button>
            <ThemePicker className="px-3 py-2" />
          </div>

          <div className="pt-3 mt-3 border-t">
            <Button
              variant="ghost"
              className="flex w-full items-center justify-start gap-3 rounded-md px-3 py-2.5 text-left text-sm"
              title="Đăng xuất"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              <LogOut className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
              <span>{isLoggingOut ? "Đang xử lý…" : "Đăng xuất"}</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
