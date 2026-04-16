"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import {
  clearNavigationIntent,
  startNavigationIntent,
  useNavigationIntentStore,
} from "@/components/navigation/navigationIntentStore";

/**
 * Thanh progress khi có intent điều hướng (click / popstate) — hiện ngay, không chờ pathname.
 * Pathname đổi xong thì clear intent (khu vực nội dung do `loading.js` + skeleton xử lý).
 * z-[45]: trên chrome (header z-40), dưới modal (z-50+) để nền modal phủ được thanh này.
 */
export function NavigationTopProgress() {
  const pathname = usePathname();
  const intent = useNavigationIntentStore((s) => s.intent);
  const prevPathRef = useRef(pathname);

  useLayoutEffect(() => {
    if (prevPathRef.current === pathname) {
      return;
    }
    prevPathRef.current = pathname;
    clearNavigationIntent();
  }, [pathname]);

  useEffect(() => {
    const onPopState = () => {
      startNavigationIntent();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!intent) {
      return undefined;
    }
    const t = window.setTimeout(() => clearNavigationIntent(), 15_000);
    return () => window.clearTimeout(t);
  }, [intent]);

  if (!intent) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-0 z-[45] h-[3px] overflow-hidden bg-primary/15"
      aria-hidden
    >
      <div className="h-full w-[42%] max-w-[min(18rem,45vw)] bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.5)] motion-reduce:animate-none animate-nav-intent-loop" />
    </div>
  );
}
