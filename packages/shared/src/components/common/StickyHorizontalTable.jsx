"use client";

import { Children, cloneElement, isValidElement, useLayoutEffect, useRef } from "react";
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

function paintColumns(table, widths) {
  if (!table) return;
  const cols = [...table.querySelectorAll("colgroup col")];
  const total = widths.reduce((sum, width) => sum + width, 0);
  widths.forEach((width, index) => {
    if (cols[index]) cols[index].style.width = `${width}px`;
  });
  table.style.tableLayout = "fixed";
  table.style.width = `${total}px`;
}

function alignStickyHeader(headerTrack, bodyScroll, pinHeader) {
  const headerTable = headerTrack?.querySelector("table");
  const bodyTable = bodyScroll?.querySelector("table");
  if (!headerTable || !bodyTable) return [];
  const headerCells = [
    ...headerTable.querySelectorAll("thead > tr:first-child > th, thead > tr:first-child > td"),
  ];
  if (!headerCells.length) return [];
  const bodyRows = [...bodyTable.querySelectorAll("tbody > tr")];
  const simple = bodyRows.find((row) => {
    const cells = [...row.querySelectorAll(":scope > td, :scope > th")];
    return cells.length === headerCells.length && cells.every((cell) => cell.colSpan === 1);
  });
  if (simple) {
    const bodyCells = [...simple.children];
    let total = 0;
    const widths = [];
    headerCells.forEach((cell, index) => {
      const width = bodyCells[index].getBoundingClientRect().width;
      widths.push(width);
      total += width;
      cell.style.boxSizing = "border-box";
      cell.style.width = `${width}px`;
    });
    headerTable.style.tableLayout = "fixed";
    headerTable.style.width = `${total}px`;
    return widths;
  }
  const colCount = bodyTable.querySelectorAll("colgroup col").length;
  const full = bodyRows.find((row) => {
    const cells = [...row.children];
    return cells.length === colCount && cells.every((cell) => (cell.colSpan || 1) === 1);
  });
  if (!full || !colCount) return [];
  const widths = [...full.children].map((cell) => cell.getBoundingClientRect().width);
  paintColumns(headerTable, widths);
  paintColumns(bodyTable, widths);
  paintColumns(pinHeader?.querySelector("table"), widths);
  return widths;
}

export function StickyResponsiveTable({
  ariaLabel = "Bảng dữ liệu",
  children,
  className,
  interactiveHeader = false,
  pinnedColumns = 0,
  pinnedWidthPx = 0,
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
  const pinHeaderRef = useRef(null);
  const pinWrapRef = useRef(null);
  const bodyScrollRef = useRef(null);

  useLayoutEffect(() => {
    const headerTrack = headerTrackRef.current;
    const bodyScroll = bodyScrollRef.current;
    if (!headerTrack || !bodyScroll) return undefined;
    const sync = () => {
      const widths = alignStickyHeader(headerTrack, bodyScroll, pinHeaderRef.current);
      if (pinnedColumns > 0 && widths.length >= pinnedColumns && pinWrapRef.current) {
        const pin = widths.slice(0, pinnedColumns).reduce((sum, width) => sum + width, 0);
        pinWrapRef.current.style.setProperty("--ledger-pin-width", `${pin}px`);
        let left = 0;
        widths.slice(0, pinnedColumns).forEach((width, index) => {
          bodyScroll.style.setProperty(`--ledger-pin-${index}`, `${left}px`);
          left += width;
        });
      }
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(bodyScroll);
    const bodyTable = bodyScroll.querySelector("table");
    if (bodyTable) observer.observe(bodyTable);
    return () => observer.disconnect();
  });

  if (!isValidElement(table) || table.type !== "table" || !header) {
    return (
      <div className={cn("min-w-0 rounded-lg border border-border/60", className)}>
        {children}
      </div>
    );
  }

  const headerTable = (extra) => cloneElement(
    table,
    extra,
    colGroup,
    header,
  );

  return (
    <div className={cn("min-w-0 rounded-lg border border-border/60", className)}>
      <UnifiedStickyRegion
        level={stickyLevel}
        className="overflow-hidden bg-secondary shadow-[0_1px_0_0_hsl(var(--border))]"
      >
        <div
          ref={pinWrapRef}
          className="relative overflow-hidden"
          style={pinnedWidthPx ? { "--ledger-pin-width": `${pinnedWidthPx}px` } : undefined}
        >
          {pinnedColumns > 0 ? (
            <div
              ref={pinHeaderRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 z-20 overflow-hidden bg-secondary shadow-[1px_0_0_0_hsl(var(--border))] print:hidden"
              style={{ width: "var(--ledger-pin-width, 0px)" }}
            >
              {headerTable({ "aria-hidden": true })}
            </div>
          ) : null}
          <div ref={headerTrackRef} className="will-change-transform">
            {headerTable(interactiveHeader ? {} : { "aria-hidden": true })}
          </div>
        </div>
      </UnifiedStickyRegion>
      <div
        ref={bodyScrollRef}
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
