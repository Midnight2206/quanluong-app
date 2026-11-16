"use client";

import { useCallback, useEffect, useState } from "react";
import { currentMonthYmd, monthBoundsYmd } from "@/utils/monthBoundsYmd";
import {
  btnPrimary,
  fieldClass,
  firstDayOfMonthYmd,
  formatVnd,
  formatVndBlankZero,
  labelClass,
  localYmd,
  tableWrapClass,
  toolbarClass,
} from "./midnightUi";

export function MidnightTabMatrix({ unitId }) {
  const initialMonth = currentMonthYmd();
  const initialBounds = monthBoundsYmd(initialMonth);
  const [periodMode, setPeriodMode] = useState("month");
  const [month, setMonth] = useState(initialMonth);
  const [from, setFrom] = useState(initialBounds.from);
  const [to, setTo] = useState(localYmd());
  const [partners, setPartners] = useState([]);
  const [lttpSupplierId, setLttpSupplierId] = useState("");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadPartnersErr, setLoadPartnersErr] = useState("");

  useEffect(() => {
    if (periodMode !== "month") return;
    try {
      const bounds = monthBoundsYmd(month);
      setFrom(bounds.from);
      setTo(bounds.to);
    } catch {
      /* ignore */
    }
  }, [periodMode, month]);

  useEffect(() => {
    let c = false;
    (async () => {
      if (!unitId) return;
      setLoadPartnersErr("");
      try {
        const r = await fetch(
          `/api/midnight-secret/lttp-suppliers?unitId=${encodeURIComponent(unitId)}`,
          { credentials: "include" },
        );
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error?.message || "Không tải đối tác");
        if (!c) setPartners(j.data ?? []);
      } catch (e) {
        if (!c) setLoadPartnersErr(e?.message || "");
      }
    })();
    return () => {
      c = true;
    };
  }, [unitId]);

  const load = useCallback(async () => {
    if (!unitId) {
      setErr("Chọn đơn vị kho.");
      return;
    }
    setErr("");
    setLoading(true);
    setData(null);
    try {
      const q = new URLSearchParams({ unitId, from, to });
      if (lttpSupplierId) q.set("lttpSupplierId", lttpSupplierId);
      const r = await fetch(`/api/midnight-secret/lttp-partner-money-matrix?${q.toString()}`, {
        credentials: "include",
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || j?.message || "Không tải báo cáo");
      setData(j.data ?? j);
    } catch (e) {
      setErr(e?.message || "Lỗi");
    } finally {
      setLoading(false);
    }
  }, [unitId, from, to, lttpSupplierId]);

  const cols = data?.recipientColumns ?? [];
  const days = data?.days ?? [];
  const colTotals = data?.columnTotals ?? {};
  const grand = data?.grandTotal;

  return (
    <div className="space-y-2.5">
      <form
        className={toolbarClass}
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={periodMode === "month" ? btnPrimary : `${fieldClass} px-3`}
            onClick={() => setPeriodMode("month")}
          >
            Theo tháng
          </button>
          <button
            type="button"
            className={periodMode === "range" ? btnPrimary : `${fieldClass} px-3`}
            onClick={() => {
              setPeriodMode("range");
              setFrom(firstDayOfMonthYmd());
              setTo(localYmd());
            }}
          >
            Khoảng ngày
          </button>
        </div>
        {periodMode === "month" ? (
          <label className={labelClass}>
            Tháng
            <input
              type="month"
              className={fieldClass}
              value={month}
              onChange={(e) => setMonth(e.target.value || currentMonthYmd())}
            />
          </label>
        ) : (
          <>
            <label className={labelClass}>
              Từ
              <input type="date" className={fieldClass} value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className={labelClass}>
              Đến
              <input type="date" className={fieldClass} value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </>
        )}
        <label className={labelClass}>
          Đối tác
          <select
            className={`${fieldClass} min-w-[10rem]`}
            value={lttpSupplierId}
            onChange={(e) => setLttpSupplierId(e.target.value)}
          >
            <option value="">Tất cả</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={btnPrimary} disabled={loading || !unitId}>
          {loading ? "Đang tải…" : "Tải báo cáo"}
        </button>
        {data ? (
          <p className="w-full text-[11px] text-muted-foreground sm:ml-auto sm:w-auto">
            {data.lttpSupplierLabel} · {data.from} → {data.to}
          </p>
        ) : null}
      </form>

      {loadPartnersErr ? <p className="text-xs text-amber-700 dark:text-amber-400">{loadPartnersErr}</p> : null}
      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      {data && !cols.length && !loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Không có dữ liệu theo bộ lọc.</p>
      ) : null}

      {data && cols.length > 0 ? (
        <div className={tableWrapClass}>
          <table className="w-full min-w-[36rem] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="sticky left-0 z-20 min-w-[6.5rem] border-r border-border bg-muted/50 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Ngày
                </th>
                {cols.map((c) => (
                  <th
                    key={String(c.id)}
                    className="min-w-[6.5rem] px-2 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {c.name}
                  </th>
                ))}
                <th className="min-w-[6.5rem] border-l border-border bg-muted px-2 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Tổng ngày
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date} className="border-b border-border/70 hover:bg-muted/20">
                  <td className="sticky left-0 z-10 border-r border-border/70 bg-card px-2 py-1 font-mono text-muted-foreground">
                    {d.date}
                  </td>
                  {cols.map((c) => (
                    <td key={`${d.date}-${c.id}`} className="px-2 py-1 text-right tabular-nums">
                      {formatVndBlankZero(d.byRecipient?.[String(c.id)])}
                    </td>
                  ))}
                  <td className="border-l border-border/70 bg-muted/30 px-2 py-1 text-right font-medium tabular-nums">
                    {formatVnd(d.rowTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/80 text-foreground">
                <td className="sticky left-0 z-10 border-r border-border border-t border-border bg-muted px-2 py-1.5 font-semibold">
                  Tổng ĐV
                </td>
                {cols.map((c) => (
                  <td
                    key={`t-${c.id}`}
                    className="border-t border-border px-2 py-1.5 text-right font-semibold tabular-nums"
                  >
                    {formatVnd(colTotals[String(c.id)] ?? 0)}
                  </td>
                ))}
                <td className="border-l border-border border-t border-border px-2 py-1.5 text-right text-sm font-bold tabular-nums">
                  {formatVnd(grand)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}
    </div>
  );
}
