"use client";

import { Suspense, useEffect, useState } from "react";
import { MidnightLandingPage } from "@/pages/home/MidnightLandingPage";
import { MidnightLocaleProvider } from "@/lib/midnightLocale.jsx";
import { getMainAppOrigin } from "@/utils/superadminPortal";

/**
 * Cùng trang Midnight với app chính. Khác host thì một lần sang origin chính
 * (cookie phiên không đi theo Tailscale). Cùng host thì render landing, không redirect.
 */
export default function SuperadminLandingRoute() {
  const [showHere, setShowHere] = useState(false);

  useEffect(() => {
    const main = String(getMainAppOrigin() || "").replace(/\/+$/, "");
    try {
      if (new URL(main).origin !== window.location.origin) {
        window.location.replace(`${main}/`);
        return;
      }
    } catch {
      /* render here */
    }
    setShowHere(true);
  }, []);

  if (!showHere) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Đang mở trang chủ…</p>;
  }

  return (
    <MidnightLocaleProvider>
      <Suspense fallback={null}>
        <MidnightLandingPage />
      </Suspense>
    </MidnightLocaleProvider>
  );
}
