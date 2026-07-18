"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/utils/cn";

const COMMODITY_SEARCH_DEBOUNCE_MS = 200;
const COMMODITY_SEARCH_MAX = 40;

/**
 * Ô tìm mặt hàng LTTP — dùng chung phiếu xuất / phiếu nhập kho.
 */
export function IssueSlipCommoditySearch({
  rowKey,
  commodityId,
  selectedLabel,
  commodities,
  dupRow,
  inputClass,
  disabled,
  onPickCommodity,
  placeholder = "Gõ tìm mặt hàng…",
}) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(() => selectedLabel ?? "");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [anchor, setAnchor] = useState(/** @type {DOMRect | null} */ (null));

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(query.trim().toLowerCase());
    }, COMMODITY_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setQuery(selectedLabel ?? "");
  }, [commodityId, selectedLabel]);

  const filtered = useMemo(() => {
    const list = (commodities || []).filter((c) => c && c.id != null);
    const q = debouncedQ;
    if (!q) {
      return list.slice(0, COMMODITY_SEARCH_MAX);
    }
    return list
      .filter((c) => {
        const nm = String(c.name ?? "").toLowerCase();
        const cd = String(c.code ?? "").toLowerCase();
        return nm.includes(q) || cd.includes(q);
      })
      .slice(0, COMMODITY_SEARCH_MAX);
  }, [commodities, debouncedQ]);

  const refreshAnchor = useCallback(() => {
    const el = wrapRef.current;
    if (el) {
      setAnchor(el.getBoundingClientRect());
    }
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      return undefined;
    }
    refreshAnchor();
    function onWin() {
      refreshAnchor();
    }
    window.addEventListener("scroll", onWin, true);
    window.addEventListener("resize", onWin);
    return () => {
      window.removeEventListener("scroll", onWin, true);
      window.removeEventListener("resize", onWin);
    };
  }, [open, refreshAnchor, filtered.length]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function onKey(e) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const listEl =
    open &&
    anchor &&
    createPortal(
      <ul
        className="fixed z-[120] max-h-52 overflow-y-auto rounded-md border border-border bg-card py-1 text-left text-xs text-card-foreground shadow-float"
        style={{
          top: anchor.bottom + 6,
          left: anchor.left,
          width: Math.max(anchor.width, 240),
          maxWidth: "min(96vw, 28rem)",
        }}
        role="listbox"
        aria-label="Kết quả tìm mặt hàng"
      >
        {filtered.length === 0 ? (
          <li className="bg-card px-3 py-2 text-muted-foreground">
            Không có mặt hàng khớp.
          </li>
        ) : (
          filtered.map((c) => (
            <li key={`${rowKey}-${c.id}`} role="none">
              <button
                type="button"
                role="option"
                className="flex w-full items-start gap-2 bg-card px-3 py-2 text-left hover:bg-muted"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPickCommodity(rowKey, String(c.id));
                  setOpen(false);
                }}
              >
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {c.name}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {c.code}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>,
      document.body,
    );

  return (
    <div ref={wrapRef} className="relative min-w-0 w-full">
      <input
        type="search"
        enterKeyHint="search"
        disabled={disabled}
        className={cn(
          inputClass,
          "truncate",
          dupRow && "border-red-500/90 dark:border-red-400/80",
        )}
        title={(query || selectedLabel || "").trim() || undefined}
        value={query}
        onChange={(e) => {
          const v = e.target.value;
          setOpen(true);
          if (v === "") {
            onPickCommodity(rowKey, "");
            setQuery(v);
            return;
          }
          const canon = (selectedLabel ?? "").trim();
          if (
            commodityId !== "" &&
            commodityId != null &&
            canon !== "" &&
            v.trim() !== canon
          ) {
            onPickCommodity(rowKey, "");
          }
          setQuery(v);
        }}
        onFocus={() => {
          setOpen(true);
          queueMicrotask(refreshAnchor);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 180);
        }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      {typeof document !== "undefined" ? listEl : null}
    </div>
  );
}
