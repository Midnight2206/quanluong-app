"use client";

import { useCallback, useEffect, useState } from "react";

function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatVnd(n) {
  if (n == null || !Number.isFinite(Number(n))) {
    return "—";
  }
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(n));
}

export function MidnightTabPartnerPrices({ units, unitId, onUnitId }) {
  const [asOf, setAsOf] = useState(localYmd);
  const [effSave, setEffSave] = useState(localYmd);
  const [data, setData] = useState(null);
  const [edits, setEdits] = useState({});
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [okMsg, setOkMsg] = useState("");

  const load = useCallback(async () => {
    if (!unitId) {
      return;
    }
    setErr("");
    setOkMsg("");
    setLoading(true);
    try {
      const q = new URLSearchParams({ unitId, asOf });
      const r = await fetch(`/api/midnight-secret/partner-prices?${q}`, { credentials: "include" });
      const j = await r.json();
      if (!r.ok) {
        throw new Error(j?.error?.message || j?.message || "Không tải được bảng giá");
      }
      const d = j.data ?? j;
      setData(d);
      const m = {};
      for (const it of d.items ?? []) {
        const id = it.commodity.id;
        m[id] = it.partnerUnitPrice;
      }
      setEdits(m);
    } catch (e) {
      setData(null);
      setErr(e?.message || "Lỗi");
    } finally {
      setLoading(false);
    }
  }, [unitId, asOf]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e) {
    e.preventDefault();
    if (!unitId) {
      return;
    }
    setErr("");
    setOkMsg("");
    setSaving(true);
    try {
      const rows = (data?.items ?? []).map((it) => ({
        commodityId: it.commodity.id,
        partnerUnitPrice: edits[it.commodity.id] ?? null,
      }));
      const r = await fetch("/api/midnight-secret/partner-prices", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId: Number(unitId),
          effectiveDate: effSave,
          rows,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        throw new Error(j?.error?.message || j?.message || "Lưu thất bại");
      }
      setOkMsg(
        `Đã lưu bảng giá đối tác (áp dụng ${effSave}, ${(j.data ?? j).rowCount ?? rows.length} mặt hàng).`,
      );
      void load();
    } catch (e) {
      setErr(e?.message || "Lỗi lưu");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Bảng giá đối tác tách bảng giá LTTP công khai. Chọn ngày tham chiếu để xem giá hiệu lực; chọn
        <span className="font-medium text-slate-800"> ngày áp dụng khi lưu</span> nếu cần tạo/ sửa phiên bản theo
        ngày.
      </p>

      <form onSubmit={onSave} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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
          Ngày tham chiếu (xem bảng hiệu lực)
          <input
            type="date"
            className="mt-0.5 block rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            value={asOf}
            onChange={(e) => {
              setAsOf(e.target.value);
            }}
          />
        </label>
        <label className="text-xs text-slate-600">
          Ngày áp dụng khi lưu
          <input
            type="date"
            className="mt-0.5 block rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            value={effSave}
            onChange={(e) => setEffSave(e.target.value)}
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-100"
            disabled={loading || !unitId}
          >
            {loading ? "Đang tải…" : "Tải lại"}
          </button>
          <button
            type="submit"
            className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
            disabled={saving || !unitId}
          >
            {saving ? "Đang lưu…" : "Lưu bảng giá đối tác"}
          </button>
        </div>
      </form>

      {data?.appliedTable ? (
        <p className="text-xs text-slate-500">
          Phiên bản đang thấy: hiệu lực từ <span className="font-medium text-slate-700">{data.appliedTable.effectiveDate}</span>
        </p>
      ) : (
        <p className="text-xs text-amber-700">Chưa có bảng giá đối tác nào trước ngày tham chiếu — nhập giá và lưu (tạo phiên bản mới).</p>
      )}

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {okMsg ? <p className="text-sm text-emerald-700">{okMsg}</p> : null}

      {data?.items?.length ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm text-slate-800">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-xs font-semibold uppercase text-slate-600">
                <th className="px-3 py-2">Mã</th>
                <th className="px-3 py-2">Tên</th>
                <th className="px-3 py-2">DVT</th>
                <th className="px-3 py-2 text-right">Giá đối tác (VND)</th>
                <th className="px-3 py-2 text-right">Xem nhanh</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it) => {
                const id = it.commodity.id;
                const v = edits[id];
                return (
                  <tr key={id} className="border-b border-slate-100">
                    <td className="px-3 py-1.5 font-mono text-xs">{it.commodity.code}</td>
                    <td className="px-3 py-1.5">{it.commodity.name}</td>
                    <td className="px-3 py-1.5 text-slate-600">{it.commodity.measureUnit}</td>
                    <td className="px-3 py-1.5 text-right">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="w-32 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                        value={v == null || Number.isNaN(v) ? "" : v}
                        onChange={(e) => {
                          const t = e.target.value;
                          if (t === "") {
                            setEdits((s) => ({ ...s, [id]: null }));
                            return;
                          }
                          setEdits((s) => ({ ...s, [id]: Number(t) }));
                        }}
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-500 tabular-nums">
                      {formatVnd(v)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
