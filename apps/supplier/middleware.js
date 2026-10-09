import { NextResponse } from "next/server";
import { createAuthMiddleware } from "@quanluong/shared/next-auth-middleware";

const authMiddleware = createAuthMiddleware();

export default function middleware(request) {
  const { pathname } = request.nextUrl;
  // Profile and settings are protected on the main app. Here the client gate
  // sends a signed-out visitor to the main login instead of this origin's /login.
  if (pathname === "/profile" || pathname === "/settings") {
    return NextResponse.next();
  }
  return authMiddleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
