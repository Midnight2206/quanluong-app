"use client";

import { useCallback, useEffect, useState } from "react";

function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function firstDayOfMonthYmd() {
  const d = new Date();
  d.setDate(1);
  return localYmd(d);
}

function formatVnd(n) {
  if (n == null || !Number.isFinite(Number(n))) {
    return "—";
  }
  if (Number(n) === 0) {
    return "—";
  }
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(n));
}

function formatVnd0(n) {
  if (n == null || !Number.isFinite(Number(n))) {
    return "—";
  }
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(n));
}

export function MidnightTabMatrix({ units, unitId, onUnitId }) {
  const [from, setFrom] = useState(firstDayOfMonthYmd);
  const [to, setTo] = useState(localYmd);
  const [partners, setPartners] = useState([]);
  const [lttpSupplierId, setLttpSupplierId] = useState("");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadPartnersErr, setLoadPartnersErr] = useState("");

  useEffect(() => {
    let c = false;
    (async () => {
      if (!unitId) {
        return;
      }
      setLoadPartnersErr("");
      try {
        const r = await fetch(
          `/api/midnight-secret/lttp-suppliers?unitId=${encodeURIComponent(unitId)}`,
          { credentials: "include" },
        );
        const j = await r.json();
        if (!r.ok) {
          throw new Error(j?.error?.message || "Không tải đối tác");
        }
        if (!c) {
          setPartners(j.data ?? []);
        }
      } catch (e) {
        if (!c) {
          setLoadPartnersErr(e?.message || "");
        }
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
      if (lttpSupplierId) {
        q.set("lttpSupplierId", lttpSupplierId);
      }
      const r = await fetch(`/api/midnight-secret/lttp-partner-money-matrix?${q.toString()}`, {
        credentials: "include",
      });
      const j = await r.json();
      if (!r.ok) {
        throw new Error(j?.error?.message || j?.message || "Không tải báo cáo");
      }
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
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Thành tiền = số lượng dòng × giá từ <span className="font-medium text-slate-800">bảng giá đối tác</span> tại
        ngày phiếu, gom theo <span className="font-medium text-slate-800">ngày</span> và{" "}
        <span className="font-medium text-slate-800">đơn vị nhận LTTP</span> (cột). Có tổng theo cả dòng
        (ngày) và từng cột (đơn vị), ô góc = tổng toàn bộ.
      </p>

      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <label className="text-xs text-slate-600">
          Đơn vị cấp của user
          <select
            className="mt-0.5 block min-w-[12rem] rounded border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm text-slate-900"
            value={unitId}
            onChange={(e) => onUnitId(e.target.value)}
            disabled
          >
            {units.length === 0 ? <option value="">—</option> : null}
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-600">
          Từ
          <input
            type="date"
            className="mt-0.5 block rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-xs text-slate-600">
          Đến
          <input
            type="date"
            className="mt-0.5 block rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label className="text-xs text-slate-600">
          Đối tác
          <select
            className="mt-0.5 block min-w-[10rem] rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
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
        <button
          type="submit"
          className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          disabled={loading || !unitId}
        >
          {loading ? "Đang tải…" : "Tải báo cáo"}
        </button>
      </form>

      {loadPartnersErr ? <p className="text-xs text-amber-700">{loadPartnersErr}</p> : null}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      {data ? (
        <p className="text-sm text-slate-700">
          {data.lttpSupplierLabel} · Kho: {data.unit?.name} · {data.from} → {data.to}
        </p>
      ) : null}

      {data && !cols.length && !loading ? (
        <p className="text-sm text-slate-500">Chưa có dữ liệu theo bộ lọc (dòng đối tác tương ứng trong giai đoạn).</p>
      ) : null}

      {data && cols.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[40rem] border-collapse text-left text-xs text-slate-800 sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-xs font-semibold text-slate-600">
                <th className="sticky left-0 z-20 min-w-[7rem] border-r border-slate-200 bg-slate-100 px-2 py-2">
                  Ngày
                </th>
                {cols.map((c) => (
                  <th key={String(c.id)} className="min-w-[7rem] px-2 py-2 text-right">
                    {c.name}
                  </th>
                ))}
                <th className="min-w-[7rem] border-l border-slate-200 bg-slate-200/60 px-2 py-2 text-right">Tổng ngày</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date} className="border-b border-slate-100">
                  <td className="sticky left-0 z-10 border-r border-slate-100 bg-white px-2 py-1.5 font-mono text-slate-700">
                    {d.date}
                  </td>
                  {cols.map((c) => (
                    <td key={`${d.date}-${c.id}`} className="px-2 py-1.5 text-right tabular-nums text-slate-800">
                      {formatVnd(d.byRecipient?.[String(c.id)])}
                    </td>
                  ))}
                  <td className="border-l border-slate-100 bg-slate-50/80 px-2 py-1.5 text-right font-medium tabular-nums">
                    {formatVnd0(d.rowTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-200/80 text-slate-900">
                <td className="sticky left-0 z-10 border-r border-slate-200 border-t border-slate-300 bg-slate-200 px-2 py-2 font-semibold">
                  Tổng ĐV
                </td>
                {cols.map((c) => (
                  <td key={`t-${c.id}`} className="border-t border-slate-300 px-2 py-2 text-right font-semibold tabular-nums">
                    {formatVnd0(colTotals[String(c.id)] ?? 0)}
                  </td>
                ))}
                <td className="border-t border-slate-300 border-l border-slate-200 px-2 py-2 text-right text-base font-bold tabular-nums text-slate-900">
                  {formatVnd0(grand)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}
    </div>
  );
}
