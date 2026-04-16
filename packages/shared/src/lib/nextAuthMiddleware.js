import { NextResponse } from "next/server";

/** Mặc định trùng `quanluong-app-be` (`env.js`: ACCESS_TOKEN_COOKIE_NAME / REFRESH_TOKEN_COOKIE_NAME). */
const DEFAULT_ACCESS_COOKIE = "ql.at";
const DEFAULT_REFRESH_COOKIE = "ql.rt";

export function getAuthCookieNames() {
  return {
    access: process.env.ACCESS_TOKEN_COOKIE_NAME || DEFAULT_ACCESS_COOKIE,
    refresh: process.env.REFRESH_TOKEN_COOKIE_NAME || DEFAULT_REFRESH_COOKIE,
  };
}

/** Route cần phiên (cookie access hoặc refresh). */
export function isProtectedAppPath(pathname) {
  if (pathname.startsWith("/dashboard")) {
    return true;
  }
  if (
    pathname === "/users" ||
    pathname === "/meal-roster" ||
    pathname === "/profile" ||
    pathname === "/settings"
  ) {
    return true;
  }
  return false;
}

function hasSessionCookie(request, accessName, refreshName) {
  return request.cookies.has(accessName) || request.cookies.has(refreshName);
}

/**
 * Middleware Edge: chặn sớm khi không có cookie phiên (giảm flash HTML trước khi client redirect).
 * Quyền chi tiết / superadmin vẫn do `PrivateRoute`, `SuperadminOnlyRoute`, `RouteApiGuard` xử lý.
 */
export function createAuthMiddleware(options = {}) {
  const { redirectAuthenticatedFromAuthForms = true } = options;

  return function authMiddleware(request) {
    const { pathname } = request.nextUrl;

    if (pathname.startsWith("/_next")) {
      return NextResponse.next();
    }

    const { access, refresh } = getAuthCookieNames();
    const hasToken = hasSessionCookie(request, access, refresh);

    if (isProtectedAppPath(pathname)) {
      if (!hasToken) {
        const loginUrl = new URL("/login", request.url);
        const from = `${pathname}${request.nextUrl.search}`;
        loginUrl.searchParams.set("from", from);
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.next();
    }

    if (
      redirectAuthenticatedFromAuthForms &&
      hasToken &&
      (pathname === "/login" || pathname === "/register")
    ) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  };
}
