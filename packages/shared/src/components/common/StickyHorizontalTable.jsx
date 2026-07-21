"use client";

import { Children, cloneElement, isValidElement, useRef } from "react";
import { UnifiedStickyRegion } from "@/hocs/withUnifiedPageScroll";
import { cn } from "@/utils/cn";

export function StickyHorizontalTable({
  ariaLabel = "Bảng dữ liệu",
  children,
  colGroup,
  header,
  minWidthClass,
  stickyLevel = 1,
}) {
  const headerTrackRef = useRef(null);
  const tableClassName = cn(
    "w-full table-fixed border-separate border-spacing-0 text-left text-[11px]",
    minWidthClass,
  );

  return (
    <div className="min-w-0 rounded-lg border border-border/60">
      <UnifiedStickyRegion
        level={stickyLevel}
        className="overflow-hidden bg-secondary shadow-[0_1px_0_0_hsl(var(--border))]"
      >
        <div ref={headerTrackRef} className="will-change-transform">
          <table aria-hidden="true" className={tableClassName}>
            {colGroup}
            {header}
          </table>
        </div>
      </UnifiedStickyRegion>
      <div
        aria-label={`${ariaLabel} — cuộn ngang`}
        className="min-w-0 overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        role="region"
        tabIndex={0}
        onScroll={(event) => {
          if (headerTrackRef.current) {
            headerTrackRef.current.style.transform =
              `translate3d(${-event.currentTarget.scrollLeft}px, 0, 0)`;
          }
        }}
      >
        <table className={tableClassName}>
          {colGroup}
          {cloneElement(header, { className: "sr-only" })}
          {children}
        </table>
      </div>
    </div>
  );
}

export function StickyResponsiveTable({
  ariaLabel = "Bảng dữ liệu",
  children,
  className,
  interactiveHeader = false,
  stickyLevel = 1,
}) {
  const table = Children.only(children);
  const tableChildren = isValidElement(table)
    ? Children.toArray(table.props.children)
    : [];
  const colGroup = tableChildren.find((child) => child?.type === "colgroup");
  const header = tableChildren.find((child) => child?.type === "thead");
  const body = tableChildren.filter(
    (child) => child?.type !== "colgroup" && child?.type !== "thead",
  );
  const headerTrackRef = useRef(null);

  if (!isValidElement(table) || table.type !== "table" || !header) {
    return (
      <div className={cn("min-w-0 rounded-lg border border-border/60", className)}>
        {children}
      </div>
    );
  }

  return (
    <div className={cn("min-w-0 rounded-lg border border-border/60", className)}>
      <UnifiedStickyRegion
        level={stickyLevel}
        className="overflow-hidden bg-secondary shadow-[0_1px_0_0_hsl(var(--border))]"
      >
        <div ref={headerTrackRef} className="will-change-transform">
          {cloneElement(
            table,
            interactiveHeader ? {} : { "aria-hidden": true },
            colGroup,
            header,
          )}
        </div>
      </UnifiedStickyRegion>
      <div
        aria-label={`${ariaLabel} — cuộn ngang`}
        className="min-w-0 overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        role="region"
        tabIndex={0}
        onScroll={(event) => {
          if (headerTrackRef.current) {
            headerTrackRef.current.style.transform =
              `translate3d(${-event.currentTarget.scrollLeft}px, 0, 0)`;
          }
        }}
      >
        {cloneElement(
          table,
          {},
          colGroup,
          cloneElement(
            header,
            interactiveHeader
              ? { "aria-hidden": true, hidden: true }
              : { className: cn(header.props.className, "sr-only") },
          ),
          ...body,
        )}
      </div>
    </div>
  );
}
