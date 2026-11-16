"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/25 p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="Đóng" className="absolute inset-0 cursor-default" onClick={onClose} />
      <section
        data-local-scroll="true"
        className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-xl border border-border bg-card p-4 shadow-float sm:rounded-xl sm:p-5"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground sm:text-base">{title}</h2>
          <button type="button" onClick={onClose} className={`${btnSecondary} h-8 px-2 text-xs`}>
            Đóng
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function MidnightTabPartnerDebts({ unitId = "", canWrite = false }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyPartner, setHistoryPartner] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [historyErr, setHistoryErr] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [payPartner, setPayPartner] = useState(null);
  const [paymentDate, setPaymentDate] = useState(localYmd);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [payErr, setPayErr] = useState("");
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    if (!unitId) {
      setErr("Chọn đơn vị kho.");
      setData(null);
      return;
    }
    setErr("");
    setLoading(true);
    try {
      const q = new URLSearchParams({ unitId });
      const r = await fetch(`/api/midnight-secret/partner-debts?${q}`, { credentials: "include" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || j?.message || "Không tải được công nợ");
      setData(j.data ?? j);
    } catch (e) {
      setErr(e?.message || "Lỗi tải công nợ");
    } finally {
      setLoading(false);
    }
  }, [unitId]);

  useEffect(() => {
    void load();
  }, [load]);

  const partners = data?.partners ?? [];
  const totals = data?.totals ?? {};

  const selectedHistoryTitle = useMemo(
    () => (historyPartner ? `Lịch sử thanh toán · ${historyPartner.name}` : ""),
    [historyPartner],
  );

  async function openHistory(partner) {
    setHistoryPartner(partner);
    setHistoryData(null);
    setHistoryErr("");
    setHistoryLoading(true);
    try {
      const q = unitId ? `?unitId=${encodeURIComponent(unitId)}` : "";
      const r = await fetch(`/api/midnight-secret/partner-debts/${partner.lttpSupplierId}/payments${q}`, {
        credentials: "include",
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || j?.message || "Không tải được lịch sử thanh toán");
      setHistoryData(j.data ?? j);
    } catch (e) {
      setHistoryErr(e?.message || "Lỗi tải lịch sử");
    } finally {
      setHistoryLoading(false);
    }
  }

  function openPayment(partner) {
    if (!canWrite) {
      notifyNoWritePermission();
      return;
    }
    setPayPartner(partner);
    setPaymentDate(localYmd());
    setAmount("");
    setNote("");
    setPayErr("");
  }

  async function submitPayment(e) {
    e.preventDefault();
    if (!canWrite) {
      notifyNoWritePermission();
      return;
    }
    if (!payPartner) return;
    setPayErr("");
    setPaying(true);
    try {
      const r = await fetch(`/api/midnight-secret/partner-debts/${payPartner.lttpSupplierId}/payments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentDate,
          amount: Number(amount),
          note,
          unitId: unitId ? Number(unitId) : undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || j?.message || "Không ghi được thanh toán");
      const refreshedPartnerId = payPartner.lttpSupplierId;
      setPayPartner(null);
      await load();
      if (historyPartner?.lttpSupplierId === refreshedPartnerId) {
        await openHistory(historyPartner);
      }
    } catch (e) {
      setPayErr(e?.message || "Lỗi thanh toán");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <div className={toolbarClass}>
        <button type="button" onClick={() => void load()} className={btnSecondary} disabled={loading || !unitId}>
          {loading ? "Đang tải…" : "Tải lại"}
        </button>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            Công nợ{" "}
            <span className="font-semibold tabular-nums text-foreground">{formatVnd(totals.totalDebtAmount)}</span>
          </span>
          <span>
            Đã trả{" "}
            <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatVnd(totals.totalPaidAmount)}
            </span>
          </span>
          <span>
            Còn lại{" "}
            <span className="font-semibold tabular-nums text-destructive">{formatVnd(totals.remainingAmount)}</span>
          </span>
        </div>
      </div>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      <div className={tableWrapClass}>
        <table className="w-full min-w-[36rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className={thClass}>Đối tác</th>
              <th className={`${thClass} text-right`}>Công nợ</th>
              <th className={`${thClass} text-right`}>Đã trả</th>
              <th className={`${thClass} text-right`}>Còn lại</th>
              <th className={`${thClass} text-right`}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {partners.length === 0 && !loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Chưa có dữ liệu công nợ.
                </td>
              </tr>
            ) : null}
            {partners.map((p) => (
              <tr key={p.lttpSupplierId} className="border-b border-border/70 hover:bg-muted/30">
                <td className={tdClass}>
                  <button
                    type="button"
                    onClick={() => void openHistory(p)}
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {p.name}
                  </button>
                </td>
                <td className={`${tdClass} text-right tabular-nums`}>{formatVnd(p.totalDebtAmount)}</td>
                <td className={`${tdClass} text-right tabular-nums text-emerald-700 dark:text-emerald-400`}>
                  {formatVnd(p.totalPaidAmount)}
                </td>
                <td className={`${tdClass} text-right font-semibold tabular-nums text-destructive`}>
                  {formatVnd(p.remainingAmount)}
                </td>
                <td className={`${tdClass} text-right`}>
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => void openHistory(p)}
                      className={`${btnSecondary} h-8 px-2 text-xs max-lg:min-h-11`}
                    >
                      Chi tiết
                    </button>
                    <button
                      type="button"
                      onClick={() => openPayment(p)}
                      className={`${btnPrimary} h-8 px-2 text-xs max-lg:min-h-11`}
                    >
                      Thanh toán
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {partners.length ? (
            <tfoot>
              <tr className="bg-muted/80 font-semibold text-foreground">
                <td className="px-2.5 py-1.5 text-sm">Tổng</td>
                <td className="px-2.5 py-1.5 text-right text-sm tabular-nums">{formatVnd(totals.totalDebtAmount)}</td>
                <td className="px-2.5 py-1.5 text-right text-sm tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatVnd(totals.totalPaidAmount)}
                </td>
                <td className="px-2.5 py-1.5 text-right text-sm tabular-nums text-destructive">
                  {formatVnd(totals.remainingAmount)}
                </td>
                <td className="px-2.5 py-1.5" />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {historyPartner ? (
        <Modal title={selectedHistoryTitle} onClose={() => setHistoryPartner(null)}>
          {historyLoading ? <p className="text-sm text-muted-foreground">Đang tải lịch sử…</p> : null}
          {historyErr ? <p className="text-sm text-destructive">{historyErr}</p> : null}
          {historyData ? (
            <div className="space-y-2.5">
              <p className="text-sm text-muted-foreground">
                Tổng đã thanh toán:{" "}
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatVnd(historyData.totalPaidAmount)}
                </span>
              </p>
              <div className={tableWrapClass}>
                <table className="w-full min-w-[22rem] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className={thClass}>Ngày</th>
                      <th className={`${thClass} text-right`}>Số tiền</th>
                      <th className={thClass}>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(historyData.items ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-5 text-center text-muted-foreground">
                          Chưa có lần thanh toán nào.
                        </td>
                      </tr>
                    ) : null}
                    {(historyData.items ?? []).map((row) => (
                      <tr key={row.id} className="border-b border-border/70">
                        <td className={`${tdClass} font-mono text-xs`}>{row.paymentDate}</td>
                        <td className={`${tdClass} text-right tabular-nums`}>{formatVnd(row.amount)}</td>
                        <td className={`${tdClass} text-muted-foreground`}>{row.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </Modal>
      ) : null}

      {payPartner ? (
        <Modal title={`Ghi thanh toán · ${payPartner.name}`} onClose={() => setPayPartner(null)}>
          <form onSubmit={submitPayment} className="space-y-3">
            <label className={`block ${labelClass}`}>
              Ngày thanh toán
              <input
                type="date"
                className={`${fieldClass} w-full`}
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </label>
            <label className={`block ${labelClass}`}>
              Số tiền
              <input
                type="number"
                min="0"
                step="0.01"
                className={`${fieldClass} w-full`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className={`block ${labelClass}`}>
              Ghi chú
              <textarea
                className="mt-0.5 block min-h-16 w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
              />
            </label>
            {payErr ? <p className="text-sm text-destructive">{payErr}</p> : null}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setPayPartner(null)} className={btnSecondary}>
                Hủy
              </button>
              <button type="submit" disabled={paying || !amount || Number(amount) <= 0} className={btnPrimary}>
                {paying ? "Đang lưu…" : "Ghi thanh toán"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
