"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/30 p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Đóng"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 shadow-xl sm:rounded-2xl sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
          >
            Đóng
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function MidnightTabPartnerDebts() {
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
    setErr("");
    setLoading(true);
    try {
      const r = await fetch("/api/midnight-secret/partner-debts", { credentials: "include" });
      const j = await r.json();
      if (!r.ok) {
        throw new Error(j?.error?.message || j?.message || "Không tải được công nợ");
      }
      setData(j.data ?? j);
    } catch (e) {
      setErr(e?.message || "Lỗi tải công nợ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const partners = data?.partners ?? [];
  const totals = data?.totals ?? {};

  const selectedHistoryTitle = useMemo(
    () => (historyPartner ? `Lịch sử thanh toán - ${historyPartner.name}` : ""),
    [historyPartner],
  );

  async function openHistory(partner) {
    setHistoryPartner(partner);
    setHistoryData(null);
    setHistoryErr("");
    setHistoryLoading(true);
    try {
      const r = await fetch(
        `/api/midnight-secret/partner-debts/${partner.lttpSupplierId}/payments`,
        { credentials: "include" },
      );
      const j = await r.json();
      if (!r.ok) {
        throw new Error(j?.error?.message || j?.message || "Không tải được lịch sử thanh toán");
      }
      setHistoryData(j.data ?? j);
    } catch (e) {
      setHistoryErr(e?.message || "Lỗi tải lịch sử");
    } finally {
      setHistoryLoading(false);
    }
  }

  function openPayment(partner) {
    setPayPartner(partner);
    setPaymentDate(localYmd());
    setAmount("");
    setNote("");
    setPayErr("");
  }

  async function submitPayment(e) {
    e.preventDefault();
    if (!payPartner) {
      return;
    }
    setPayErr("");
    setPaying(true);
    try {
      const r = await fetch(
        `/api/midnight-secret/partner-debts/${payPartner.lttpSupplierId}/payments`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentDate, amount: Number(amount), note }),
        },
      );
      const j = await r.json();
      if (!r.ok) {
        throw new Error(j?.error?.message || j?.message || "Không ghi được thanh toán");
      }
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
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Công nợ được đọc từ bảng tổng hợp trong DB. Hệ thống cập nhật lại công nợ khi phiếu xuất hoặc bảng giá đối tác thay đổi; thanh toán được lưu thành từng bản ghi riêng.
      </p>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-100"
          disabled={loading}
        >
          {loading ? "Đang tải..." : "Tải lại công nợ"}
        </button>
        <div className="text-xs text-slate-600">
          Tổng công nợ: <span className="font-semibold text-slate-900">{formatVnd(totals.totalDebtAmount)}</span>
          {" · "}Đã thanh toán: <span className="font-semibold text-emerald-700">{formatVnd(totals.totalPaidAmount)}</span>
          {" · "}Còn lại: <span className="font-semibold text-red-700">{formatVnd(totals.remainingAmount)}</span>
        </div>
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[44rem] border-collapse text-left text-sm text-slate-800">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-xs font-semibold uppercase text-slate-600">
              <th className="px-3 py-2">Đối tác</th>
              <th className="px-3 py-2 text-right">Tổng công nợ</th>
              <th className="px-3 py-2 text-right">Đã thanh toán</th>
              <th className="px-3 py-2 text-right">Còn lại</th>
              <th className="px-3 py-2 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {partners.length === 0 && !loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  Chưa có đối tác hoặc chưa có dữ liệu công nợ.
                </td>
              </tr>
            ) : null}
            {partners.map((p) => (
              <tr key={p.lttpSupplierId} className="border-b border-slate-100">
                <td className="px-3 py-2 font-medium">
                  <button
                    type="button"
                    onClick={() => void openHistory(p)}
                    className="text-left text-slate-900 underline-offset-2 hover:underline"
                  >
                    {p.name}
                  </button>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatVnd(p.totalDebtAmount)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{formatVnd(p.totalPaidAmount)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-red-700">{formatVnd(p.remainingAmount)}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void openHistory(p)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Chi tiết
                    </button>
                    <button
                      type="button"
                      onClick={() => openPayment(p)}
                      className="rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-white hover:bg-slate-900"
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
              <tr className="bg-slate-200/80 font-semibold text-slate-900">
                <td className="px-3 py-2">Tổng</td>
                <td className="px-3 py-2 text-right">{formatVnd(totals.totalDebtAmount)}</td>
                <td className="px-3 py-2 text-right text-emerald-700">{formatVnd(totals.totalPaidAmount)}</td>
                <td className="px-3 py-2 text-right text-red-700">{formatVnd(totals.remainingAmount)}</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {historyPartner ? (
        <Modal title={selectedHistoryTitle} onClose={() => setHistoryPartner(null)}>
          {historyLoading ? <p className="text-sm text-slate-500">Đang tải lịch sử...</p> : null}
          {historyErr ? <p className="text-sm text-red-600">{historyErr}</p> : null}
          {historyData ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Tổng đã thanh toán: <span className="font-semibold text-emerald-700">{formatVnd(historyData.totalPaidAmount)}</span>
              </p>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[24rem] text-sm">
                  <thead>
                    <tr className="border-b bg-slate-100 text-xs uppercase text-slate-600">
                      <th className="px-3 py-2 text-left">Ngày thanh toán</th>
                      <th className="px-3 py-2 text-right">Số tiền</th>
                      <th className="px-3 py-2 text-left">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(historyData.items ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-5 text-center text-slate-500">
                          Chưa có lần thanh toán nào.
                        </td>
                      </tr>
                    ) : null}
                    {(historyData.items ?? []).map((row) => (
                      <tr key={row.id} className="border-b border-slate-100">
                        <td className="px-3 py-2 font-mono text-xs">{row.paymentDate}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatVnd(row.amount)}</td>
                        <td className="px-3 py-2 text-slate-600">{row.note || "—"}</td>
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
        <Modal title={`Ghi thanh toán - ${payPartner.name}`} onClose={() => setPayPartner(null)}>
          <form onSubmit={submitPayment} className="space-y-3">
            <label className="block text-sm text-slate-600">
              Ngày thanh toán
              <input
                type="date"
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-600">
              Số tiền thanh toán
              <input
                type="number"
                min="0"
                step="0.01"
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="block text-sm text-slate-600">
              Ghi chú
              <textarea
                className="mt-1 block min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
              />
            </label>
            {payErr ? <p className="text-sm text-red-600">{payErr}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayPartner(null)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={paying || !amount || Number(amount) <= 0}
                className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
              >
                {paying ? "Đang lưu..." : "Ghi thanh toán"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
