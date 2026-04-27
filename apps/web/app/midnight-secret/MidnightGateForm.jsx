"use client";

import { useState } from "react";

export function MidnightGateForm() {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/midnight-secret/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j?.error?.message || j?.message || "Không thể xác thực");
        return;
      }
      window.location.reload();
    } catch {
      setErr("Lỗi mạng");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-base font-semibold text-slate-800">Truy cập hạn chế</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Nhập mật khẩu nội bộ để tiếp tục.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <label className="block text-sm text-slate-600">
            Mật khẩu
            <input
              type="password"
              autoComplete="off"
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 focus:border-slate-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          <button
            type="submit"
            disabled={busy || !password.trim()}
            className="w-full rounded-lg bg-slate-800 py-2.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {busy ? "Đang kiểm tra…" : "Vào"}
          </button>
        </form>
      </div>
    </div>
  );
}
