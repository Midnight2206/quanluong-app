import { createAuthMiddleware } from "@quanluong/shared/next-auth-middleware";

export default createAuthMiddleware();

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
