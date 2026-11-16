"use client";

import { useState } from "react";
import { UnifiedPageScrollRoot } from "@/hocs/withUnifiedPageScroll";
import { btnPrimary, fieldClass } from "./midnightUi";

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
    <div data-page-scroll-owner="true" className="h-dvh overflow-y-auto bg-background">
      <UnifiedPageScrollRoot className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-soft">
          <h1 className="text-center text-base font-semibold text-foreground">Truy cập hạn chế</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">Nhập mật khẩu nội bộ để tiếp tục.</p>
          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <label className="block text-sm text-muted-foreground">
              Mật khẩu
              <input
                type="password"
                autoComplete="off"
                className={`${fieldClass} w-full`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {err ? <p className="text-sm text-destructive">{err}</p> : null}
            <button type="submit" disabled={busy || !password.trim()} className={`${btnPrimary} w-full`}>
              {busy ? "Đang kiểm tra…" : "Vào"}
            </button>
          </form>
        </div>
      </UnifiedPageScrollRoot>
    </div>
  );
}
