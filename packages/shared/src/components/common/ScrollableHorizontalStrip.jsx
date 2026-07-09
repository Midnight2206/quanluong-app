"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";

/**
 * Vùng cuộn ngang có gradient gợi ý — dùng cho tab nav, bảng rộng.
 */
export function ScrollableHorizontalStrip({
  children,
  className,
  innerClassName,
  role,
  "aria-label": ariaLabel,
}) {
  const ref = useRef(null);
  const [fade, setFade] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }
    const update = () => {
      setFade({
        left: el.scrollLeft > 4,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      ro?.disconnect();
    };
  }, [children]);

  return (
    <div className={cn("relative min-w-0", className)}>
      {fade.left ? (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-5 bg-gradient-to-r from-background to-transparent"
          aria-hidden
        />
      ) : null}
      {fade.right ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-7 bg-gradient-to-l from-background to-transparent"
          aria-hidden
        />
      ) : null}
      <div
        ref={ref}
        role={role}
        aria-label={ariaLabel}
        className={cn(
          "flex min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]",
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Bọc `<table>` — cuộn ngang trên mobile/tablet khi cột vượt viewport.
 */
export function ResponsiveTableWrap({ children, className }) {
  return (
    <ScrollableHorizontalStrip
      className={cn("rounded-lg border border-border/70", className)}
      innerClassName="block min-w-0"
    >
      <div className="inline-block min-w-full align-top">{children}</div>
    </ScrollableHorizontalStrip>
  );
}
