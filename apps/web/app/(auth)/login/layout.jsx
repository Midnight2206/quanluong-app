"use client";

import { PublicOnlyRoute } from "@/hocs/PublicOnlyRoute";

export default function LoginGuardLayout({ children }) {
  return <PublicOnlyRoute>{children}</PublicOnlyRoute>;
}
