"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, MoonStar, Settings, Sun, UserRound, X } from "lucide-react";
import { useLogoutWithDraftGuard } from "@/features/auth/hooks/useLogoutWithDraftGuard";
import { useLocalUnsavedFieldMarks } from "@/hooks/useLocalUnsavedFieldMarks";
import { usePrivateDomUiPersist } from "@/hooks/usePrivateDomUiPersist";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import { cn } from "@/utils/cn";
import { getStoredTheme, initializeTheme, toggleTheme } from "@/utils/theme";

const NAV_ITEMS = [
  { href: "/", label: "Trang chủ" },
  { href: "/dat-hang", label: "Đặt hàng" },
  { href: "/so-cong-no", label: "Sổ công nợ" },
];

function isActive(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SupplierShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const { logoutWithDraftGuard, isLoggingOut } = useLogoutWithDraftGuard();
  const [navOpen, setNavOpen] = useState(false);
  const [navMounted, setNavMounted] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [theme, setTheme] = useState("light");
  const accountRef = useRef(null);

  usePrivateDomUiPersist();
  useLocalUnsavedFieldMarks();

  useEffect(() => {
    setTheme(initializeTheme());
    setNavMounted(true);
  }, []);

  useEffect(() => {
    setNavOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setNavOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

  useEffect(() => {
    function onPointerDown(event) {
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const displayName = user?.profile?.fullName || user?.username || "Nhà cung cấp";

  async function handleLogout() {
    const ok = await logoutWithDraftGuard();
    setAccountOpen(false);
    if (ok) {
      router.refresh();
    }
  }

  return (
    <div data-page-scroll-owner="true" className="h-dvh overflow-auto bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-background text-foreground transition hover:bg-secondary md:hidden"
            aria-expanded={navOpen}
            aria-controls="supplier-nav"
            onClick={() => setNavOpen((open) => !open)}
          >
            {navOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            <span className="sr-only">{navOpen ? "Đóng menu" : "Mở menu"}</span>
          </button>

          <Link href="/" className="min-w-0 shrink truncate text-sm font-semibold tracking-tight">
            Cổng nhà cung cấp
          </Link>

          <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Chính">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition",
                  isActive(pathname, item.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
                )}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="relative ml-auto flex items-center gap-2" ref={accountRef}>
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm transition hover:bg-secondary"
              title={theme === "dark" ? "Chế độ sáng" : "Chế độ tối"}
              onClick={() => setTheme(toggleTheme())}
            >
              {theme === "dark" ? (
                <Sun className="size-4 text-amber-600 dark:text-amber-300" aria-hidden />
              ) : (
                <MoonStar className="size-4" aria-hidden />
              )}
              <span className="sr-only">{theme === "dark" ? "Chế độ sáng" : "Chế độ tối"}</span>
            </button>

            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-background px-2 text-sm shadow-sm transition hover:border-primary/40"
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              onClick={() => setAccountOpen((open) => !open)}
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <UserRound className="size-4" aria-hidden />
              </span>
              <span className="hidden max-w-40 truncate pr-1 sm:inline">{displayName}</span>
            </button>

            <div
              role="menu"
              className={cn(
                "absolute right-0 top-full z-50 mt-2 w-64 origin-top-right rounded-2xl border border-border bg-card p-2 shadow-lg transition duration-200 ease-out",
                accountOpen
                  ? "pointer-events-auto translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-1 opacity-0",
              )}
            >
              <p className="truncate px-3 py-2 text-sm font-medium">{displayName}</p>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-secondary"
                onClick={() => {
                  setAccountOpen(false);
                  router.push("/settings");
                }}
              >
                <Settings className="size-4 text-muted-foreground" aria-hidden />
                Cài đặt
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-secondary"
                onClick={() => {
                  setAccountOpen(false);
                  router.push("/profile");
                }}
              >
                <UserRound className="size-4 text-muted-foreground" aria-hidden />
                Trang cá nhân
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-destructive hover:bg-secondary"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                <LogOut className="size-4" aria-hidden />
                {isLoggingOut ? "Đang xử lý…" : "Đăng xuất"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {navMounted
        ? createPortal(
      <div
        className={cn(
          "fixed inset-0 z-[60] md:hidden",
          navOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={navOpen ? undefined : true}
      >
        <button
          type="button"
          className={cn(
            "absolute inset-0 bg-black/50 transition-opacity duration-200 ease-out",
            navOpen ? "opacity-100" : "opacity-0",
          )}
          aria-label="Đóng menu"
          tabIndex={navOpen ? 0 : -1}
          onClick={() => setNavOpen(false)}
        />
        <nav
          id="supplier-nav"
          aria-label="Chính"
          className={cn(
            "absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col border-r border-border bg-card shadow-lg transition-transform duration-200 ease-out",
            navOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <p className="text-sm font-semibold">Menu</p>
            <button
              type="button"
              className="inline-flex size-12 items-center justify-center rounded-xl border border-border bg-background text-foreground"
              aria-label="Đóng menu"
              onClick={() => setNavOpen(false)}
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="flex flex-col gap-1 p-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-3 text-sm font-medium transition",
                  isActive(pathname, item.href)
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-secondary",
                )}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                tabIndex={navOpen ? 0 : -1}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>,
        document.body,
        )
        : null}

      <main>{children}</main>
    </div>
  );
}
