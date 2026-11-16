"use client";

import { useCallback, useEffect, useState } from "react";
import { notifyNoWritePermission } from "@/features/permissions/permissionUi";
import {
  btnPrimary,
  btnSecondary,
  fieldClass,
  formatVnd,
  labelClass,
  localYmd,
  tableWrapClass,
  tdClass,
  thClass,
  toolbarClass,
} from "./midnightUi";

export function MidnightTabPartnerPrices({ unitId, canWrite = false }) {
  const [asOf, setAsOf] = useState(localYmd);
  const [effSave, setEffSave] = useState(localYmd);
  const [data, setData] = useState(null);
  const [edits, setEdits] = useState({});
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [okMsg, setOkMsg] = useState("");

  const load = useCallback(async () => {
    if (!unitId) return;
    setErr("");
    setOkMsg("");
    setLoading(true);
    try {
      const q = new URLSearchParams({ unitId, asOf });
      const r = await fetch(`/api/midnight-secret/partner-prices?${q}`, { credentials: "include" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || j?.message || "Không tải được bảng giá");
      const d = j.data ?? j;
      setData(d);
      const m = {};
      for (const it of d.items ?? []) {
        m[it.commodity.id] = it.partnerUnitPrice;
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
    if (!canWrite) {
      notifyNoWritePermission();
      return;
    }
    if (!unitId) return;
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
      if (!r.ok) throw new Error(j?.error?.message || j?.message || "Lưu thất bại");
      setOkMsg(`Đã lưu · áp dụng ${effSave} · ${(j.data ?? j).rowCount ?? rows.length} mặt hàng`);
      void load();
    } catch (e) {
      setErr(e?.message || "Lỗi lưu");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <form onSubmit={onSave} className={toolbarClass}>
        <label className={labelClass}>
          Ngày xem
          <input type="date" className={fieldClass} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </label>
        <label className={labelClass}>
          Ngày lưu
          <input
            type="date"
            className={fieldClass}
            value={effSave}
            onChange={(e) => setEffSave(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className={btnSecondary}
            disabled={loading || !unitId}
          >
            {loading ? "Đang tải…" : "Tải lại"}
          </button>
          <button type="submit" className={btnPrimary} disabled={saving || !unitId}>
            {saving ? "Đang lưu…" : "Lưu giá"}
          </button>
        </div>
        {data?.appliedTable ? (
          <p className="w-full text-[11px] text-muted-foreground sm:ml-auto sm:w-auto">
            Hiệu lực từ <span className="font-medium text-foreground">{data.appliedTable.effectiveDate}</span>
          </p>
        ) : (
          <p className="w-full text-[11px] text-amber-700 dark:text-amber-400 sm:ml-auto sm:w-auto">
            Chưa có phiên bản — nhập giá rồi lưu
          </p>
        )}
      </form>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      {okMsg ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{okMsg}</p> : null}

      {data?.items?.length ? (
        <div className={tableWrapClass}>
          <table className="w-full min-w-[28rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className={thClass}>Mã</th>
                <th className={thClass}>Tên</th>
                <th className={thClass}>ĐVT</th>
                <th className={`${thClass} text-right`}>Giá đối tác</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it) => {
                const id = it.commodity.id;
                const v = edits[id];
                return (
                  <tr key={id} className="border-b border-border/70 hover:bg-muted/30">
                    <td className={`${tdClass} font-mono text-xs text-muted-foreground`}>{it.commodity.code}</td>
                    <td className={tdClass}>{it.commodity.name}</td>
                    <td className={`${tdClass} text-muted-foreground`}>{it.commodity.measureUnit}</td>
                    <td className={`${tdClass} text-right`}>
                      <div className="inline-flex items-center justify-end gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          className="h-8 w-28 rounded-md border border-input bg-background px-2 text-right text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
                          aria-label={`Giá ${it.commodity.name}`}
                        />
                        <span className="hidden w-24 text-right text-xs tabular-nums text-muted-foreground lg:inline">
                          {formatVnd(v)}
                        </span>
                      </div>
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
