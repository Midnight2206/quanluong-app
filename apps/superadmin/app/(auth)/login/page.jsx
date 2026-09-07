"use client";

import { useEffect } from "react";
import { getMainAppOrigin } from "@/utils/superadminPortal";

export default function LoginRoutePage() {
  useEffect(() => {
    window.location.replace(`${getMainAppOrigin()}/login`);
  }, []);

  return <p className="text-sm text-muted-foreground">Chuyển tới trang đăng nhập…</p>;
}
