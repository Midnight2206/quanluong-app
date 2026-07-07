"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/utils/cn";

const DEBOUNCE_MS = 250;
const MAX = 80;

export function KitchenCommodityPicker({ commodities, commodityId, onPick, disabled, className }) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [anchor, setAnchor] = useState(null);

  const selected = useMemo(
    () => (commodities || []).find((c) => c.id === commodityId),
    [commodities, commodityId],
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim().toLowerCase()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (selected) {
      setQuery(`${selected.code ?? ""} — ${selected.name ?? ""}`.trim());
    } else if (!commodityId) {
      setQuery("");
    }
  }, [commodityId, selected]);

  const filtered = useMemo(() => {
    const list = (commodities || []).filter((c) => c?.id != null);
    const q = debouncedQ;
    if (!q) {
      return list.slice(0, MAX);
    }
    return list
      .filter((c) => {
        const nm = String(c.name ?? "").toLowerCase();
        const cd = String(c.code ?? "").toLowerCase();
        return nm.includes(q) || cd.includes(q);
      })
      .slice(0, MAX);
  }, [commodities, debouncedQ]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function refresh() {
      const el = wrapRef.current;
      if (el) {
        setAnchor(el.getBoundingClientRect());
      }
    }
    refresh();
    window.addEventListener("scroll", refresh, true);
    window.addEventListener("resize", refresh);
    return () => {
      window.removeEventListener("scroll", refresh, true);
      window.removeEventListener("resize", refresh);
    };
  }, [open, filtered.length]);

  const dropdown =
    open && anchor && typeof document !== "undefined"
      ? createPortal(
          <ul
            className="fixed z-[200] max-h-56 overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-lg"
            style={{
              top: anchor.bottom + 4,
              left: anchor.left,
              width: Math.max(anchor.width, 240),
            }}
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-muted-foreground">Không có kết quả</li>
            ) : (
              filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-muted"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onPick(c);
                      setQuery(`${c.code ?? ""} — ${c.name ?? ""}`.trim());
                      setOpen(false);
                    }}
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {c.code} · {c.measureUnit}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>,
          document.body,
        )
      : null;

  return (
    <>
      <div ref={wrapRef} className={cn("relative", className)}>
        <input
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
          placeholder="Tìm mặt hàng LTTP…"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {dropdown}
    </>
  );
}
