import { createAuthMiddleware } from "@quanluong/shared/next-auth-middleware";

export default createAuthMiddleware();

/** Phải là literal tĩnh — Next không chấp nhận re-export từ package. */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
