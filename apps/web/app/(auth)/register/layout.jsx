"use client";

import { PublicOnlyRoute } from "@/hocs/PublicOnlyRoute";

export default function RegisterGuardLayout({ children }) {
  return <PublicOnlyRoute>{children}</PublicOnlyRoute>;
}
