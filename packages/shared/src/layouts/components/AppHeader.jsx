"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  LogIn,
  LogOut,
  MessageCircle,
  MoonStar,
  Sun,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startNavigationIntent } from "@/components/navigation/navigationIntentStore";
import { AppBrand } from "@/components/common/AppBrand";
import { Button } from "@/components/ui/Button";
import { useLogoutMutation } from "@/features/auth/api/authApi";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import { cn } from "@/utils/cn";
import { resolveMediaUrl } from "@/utils/runtimeEnv";
import { getStoredTheme, toggleTheme } from "@/utils/theme";
import { useChatDockOptional } from "@/contexts/ChatDockContext";

export function AppHeader() {
  const router = useRouter();
  const user = useCurrentUser();
  const chatDock = useChatDockOptional();
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => getStoredTheme());
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

  const handleToggleTheme = () => {
    setTheme(toggleTheme());
  };

  const displayName = user?.profile?.fullName || user?.username || "Khách";
  const avatarUrl = user?.profile?.avatarUrl ? resolveMediaUrl(user.profile.avatarUrl) : null;

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } finally {
      setIsMenuOpen(false);
    }
  };

  return (
    <header className="relative z-40 flex h-16 shrink-0 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur print:hidden sm:px-5 lg:px-6">
      <div className="flex items-center min-w-0 gap-3">
        <div className="lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#f26f21] text-xs font-bold text-white shadow-soft">
              QL
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                Quân lương
              </p>
              <p className="text-xs font-semibold">Workspace</p>
            </div>
          </div>
        </div>
        <div className="hidden lg:block">
          <AppBrand />
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto sm:gap-3" ref={menuRef}>
        <button
          type="button"
          className="inline-flex items-center justify-center w-10 h-10 transition rounded-full text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
        >
          <Bell className="w-5 h-5" />
        </button>
        {user && chatDock ? (
          <button
            type="button"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-secondary-foreground"
            title="Tin nhắn"
            aria-label="Mở tin nhắn"
            onClick={() => chatDock.setHubOpen(true)}
          >
            <MessageCircle className="h-5 w-5" />
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
            className="flex items-center gap-2 px-1 py-1 pr-3 transition border rounded-full bg-background shadow-soft hover:border-primary/30"
            onClick={() => setIsMenuOpen((value) => !value)}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-accent-foreground">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound className="w-5 h-5" />
              )}
            </div>
            <ChevronDown className="hidden w-4 h-4 text-muted-foreground sm:block" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition border rounded-full bg-background shadow-soft hover:border-primary/30"
            >
              <LogIn className="w-4 h-4" />
              Đăng nhập
            </Link>
            <Link
              href="/register"
              className="hidden px-4 py-2 text-sm font-medium transition rounded-full bg-primary text-primary-foreground shadow-soft hover:opacity-90 sm:inline-flex"
            >
              Đăng ký
            </Link>
          </div>
        )}

        <div
          className={cn(
            "absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[min(22rem,calc(100vw-2rem))] rounded-3xl border bg-card p-4 shadow-float transition",
            isMenuOpen && user
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-2 opacity-0",
          )}
        >
          <div className="flex items-center gap-3 pb-4 border-b">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-accent-foreground">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound className="h-7 w-7" />
              )}
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
              className="flex items-center w-full gap-3 px-3 py-3 text-sm text-left transition rounded-2xl hover:bg-secondary"
              onClick={() => {
                setIsMenuOpen(false);
                startNavigationIntent();
                router.push("/profile");
              }}
            >
              <UserRound className="w-4 h-4 text-muted-foreground" />
              Trang cá nhân
            </button>
            <button
              type="button"
              className="flex items-center w-full gap-3 px-3 py-3 text-sm text-left transition rounded-2xl hover:bg-secondary"
              onClick={handleToggleTheme}
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-muted-foreground" />
              ) : (
                <MoonStar className="w-4 h-4 text-muted-foreground" />
              )}
              {theme === "dark" ? "Chế độ sáng" : "Chế độ tối"}
            </button>
          </div>

          <div className="pt-3 mt-3 border-t">
            <Button
              variant="ghost"
              className="flex w-full items-center justify-start gap-3 rounded-2xl px-3 py-3 text-left text-sm"
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
