"use client";

import { useNetworkStatus } from "../hooks/useNetworkStatus.js";

/** Reserves space for the fixed offline banner only. */
export function OfflineChromeOffset() {
  const { online } = useNetworkStatus();
  if (online) {
    return null;
  }
  return <div aria-hidden className="shrink-0 print:hidden" style={{ height: 36 }} />;
}
