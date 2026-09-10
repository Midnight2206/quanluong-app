"use client";

import { usePathname } from "next/navigation";
import { mainNavItems } from "@/features/navigation/navConfig";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import { GuardedNavLink } from "@/hocs/GuardedNavLink";
import { useRouteDecision } from "@/features/route-access/routeAccessHooks";
import { cn } from "@/utils/cn";

function filterNavItemsForSession(items, user) {
  return items.filter((item) => !item.requiresAuth || user);
}

/** Khớp route với mục sidebar (hỗ trợ `activePathPrefix` khi `to` là entry hẹp, ví dụ `/dashboard/units`). */
function navItemPathMatches(item, pathname) {
  if (item.activePathPrefix) {
    return pathname === item.activePathPrefix || pathname.startsWith(`${item.activePathPrefix}/`);
  }
  if (pathname === item.to) {
    return true;
  }
  if (item.to !== "/" && pathname.startsWith(`${item.to}/`)) {
    return true;
  }
  return false;
}

function SidebarExternalLink({ item, pathname, afterNav, classNameBuilder, title }) {
  const decision = useRouteDecision(item.routeAccessKey);
  if (item.routeAccessKey && decision === "forbidden") {
    return null;
  }
  const active = navItemPathMatches(item, pathname);
  const href =
    typeof item.resolveHref === "function" ? item.resolveHref() : item.to;
  return (
    <a
      href={href}
      onClick={afterNav}
      title={title}
      className={classNameBuilder({ isActive: active })}
    >
      <item.icon className="size-5 shrink-0" aria-hidden />
      <span className="line-clamp-2 text-center leading-tight">{item.label}</span>
    </a>
  );
}

/**
 * Desktop (lg+): cột trái cố định.
 * Mobile: thanh tab cố định dưới cùng (không drawer).
 *
 * @param {{ items?: typeof mainNavItems, onMobileNavActivate?: () => void }} props
 */
export function AppSidebar({ items = mainNavItems, onMobileNavActivate }) {
  const pathname = usePathname();
  const user = useCurrentUser();
  const visibleItems = filterNavItemsForSession(items, user);
  const afterNav = onMobileNavActivate;

  return (
    <>
      <aside className="hidden h-full w-24 shrink-0 flex-col border-r border-border bg-card text-card-foreground print:hidden lg:flex">
        <nav
          data-local-scroll="true"
          className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 py-4"
          aria-label="Điều hướng chính"
        >
          {visibleItems.map((item, index) => {
            const prev = visibleItems[index - 1];
            const showSection = item.section && item.section !== prev?.section;
            const title = item.title ?? item.label;
            const classNameBuilder = ({ isActive }) => {
              const active = navItemPathMatches(item, pathname) || isActive;
              return cn(
                "flex flex-col items-center gap-2 rounded-2xl px-2 py-3 text-[11px] font-medium transition",
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground",
              );
            };
            return (
              <div key={item.to} className="flex flex-col gap-1">
                {showSection ? (
                  <p className="px-1 pt-2 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.section}
                  </p>
                ) : null}
                {item.external ? (
                  <SidebarExternalLink
                    item={item}
                    pathname={pathname}
                    afterNav={afterNav}
                    classNameBuilder={classNameBuilder}
                    title={title}
                  />
                ) : (
                  <GuardedNavLink
                    routeAccessKey={item.routeAccessKey}
                    href={item.to}
                    end={item.to === "/" || Boolean(item.activePathPrefix)}
                    onClick={afterNav}
                    title={title}
                    className={classNameBuilder}
                  >
                    <item.icon className="size-5 shrink-0" aria-hidden />
                    <span className="text-center leading-tight">{item.label}</span>
                  </GuardedNavLink>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex overflow-x-auto items-stretch gap-0.5 border-t border-border bg-card/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-md print:hidden supports-[backdrop-filter]:bg-card/85 lg:hidden"
        aria-label="Điều hướng chính"
      >
        {visibleItems.map((item) => {
          const title = item.title ?? item.label;
          const classNameBuilder = ({ isActive }) => {
            const active = navItemPathMatches(item, pathname) || isActive;
            return cn(
              "flex min-h-[3.25rem] flex-1 min-w-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium leading-tight transition touch-manipulation sm:min-w-[4rem] sm:gap-1 sm:text-[11px]",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground active:bg-secondary/90 active:text-foreground",
            );
          };
          if (item.external) {
            return (
              <SidebarExternalLink
                key={item.to}
                item={item}
                pathname={pathname}
                afterNav={afterNav}
                classNameBuilder={classNameBuilder}
                title={title}
              />
            );
          }
          return (
            <GuardedNavLink
              key={item.to}
              routeAccessKey={item.routeAccessKey}
              href={item.to}
              end={item.to === "/" || Boolean(item.activePathPrefix)}
              onClick={afterNav}
              title={title}
              className={classNameBuilder}
            >
              <item.icon className="size-[1.35rem] shrink-0 sm:size-5" aria-hidden />
              <span className="sr-only sm:not-sr-only sm:line-clamp-2 sm:w-full sm:text-center">{item.label}</span>
            </GuardedNavLink>
          );
        })}
      </nav>
    </>
  );
}
