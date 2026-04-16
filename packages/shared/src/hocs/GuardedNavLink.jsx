"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouteDecision } from "@/features/route-access/routeAccessHooks";

function computeActive(pathname, href, end) {
  if (end) {
    return pathname === href;
  }
  if (pathname === href) {
    return true;
  }
  return pathname.startsWith(`${href}/`);
}

/**
 * Link điều hướng (Next) + quyền theo `routeAccessKey`.
 * Dùng `href` và `end` (giống NavLink: `end` = khớp đúng path).
 */
export function GuardedNavLink({ routeAccessKey, href, end = false, className, children, ...rest }) {
  const pathname = usePathname();
  const decision = useRouteDecision(routeAccessKey);
  if (routeAccessKey && decision === "forbidden") {
    return null;
  }
  const isActive = computeActive(pathname, href, end);
  const resolvedClass = typeof className === "function" ? className({ isActive }) : className;
  return (
    <Link href={href} prefetch className={resolvedClass} {...rest}>
      {children}
    </Link>
  );
}

/**
 * HOC: bọc component link/tab.
 * @template P
 * @param {string | undefined} routeAccessKey
 * @param {import('react').ComponentType<P>} [Component]
 */
export function withRouteAccessNavLink(routeAccessKey, Component = Link) {
  const Comp = Component;
  function WrappedNavLink({ href, className, children, ...props }) {
    const pathname = usePathname();
    const decision = useRouteDecision(routeAccessKey);
    if (routeAccessKey && decision === "forbidden") {
      return null;
    }
    const isActive = href ? computeActive(pathname, href, false) : false;
    const resolvedClass = typeof className === "function" ? className({ isActive }) : className;
    return (
      <Comp href={href} className={resolvedClass} {...props}>
        {children}
      </Comp>
    );
  }
  WrappedNavLink.displayName = `withRouteAccessNavLink(${routeAccessKey ?? "open"}, ${Comp.displayName || Comp.name || "Link"})`;
  return WrappedNavLink;
}
