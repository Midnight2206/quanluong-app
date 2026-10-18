"use client";

import { useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/contexts/ConfirmProvider";
import {
  useBaTokensQuery,
  useCreateBaTokenMutation,
  useRevokeBaTokenMutation,
} from "@/features/ba-profiles/api/baProfilesApi";
import { notifyError, notifySuccess } from "@/services/notify";
import { fieldClass } from "@/utils/fieldClass";
import { cn } from "@/utils/cn";

function fmt(iso) {
  return iso ? new Date(iso).toLocaleString("vi-VN") : "—";
}

/** Tạo / thu hồi mã khóa BA. `scope`: UNIT_PUSH (admin đơn vị), GLOBAL_READ / GLOBAL_WRITE (superadmin). */
export function BaTokenManager({ scope }) {
  const { confirm } = useConfirm();
  const { data, isLoading } = useBaTokensQuery();
  const [create, { isLoading: creating }] = useCreateBaTokenMutation();
  const [revoke, { isLoading: revoking }] = useRevokeBaTokenMutation();
  const [name, setName] = useState("");
  const [rawToken, setRawToken] = useState("");

  const rows = (Array.isArray(data) ? data : []).filter((t) => t.scope === scope);

  async function onCreate() {
    try {
      const res = await create({ name: name.trim() || "Trợ lý BA", scope });
      setRawToken(res?.token || "");
      setName("");
    } catch (error) {
      notifyError(error?.data?.message || "Không tạo được mã khóa.");
    }
  }

  async function onRevoke(t) {
    const ok = await confirm({
      title: `Thu hồi ${t.prefix}…`,
      message: "Trợ lý dùng mã này sẽ không gọi API được nữa.",
      confirmLabel: "Thu hồi",
      cancelLabel: "Huỷ",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await revoke(t.id);
      notifySuccess("Đã thu hồi mã khóa.");
    } catch (error) {
      notifyError(error?.data?.message || "Không thu hồi được.");
    }
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(rawToken);
      notifySuccess("Đã chép mã khóa.");
    } catch {
      notifyError("Không chép được, hãy bôi đen và chép tay.");
    }
  }

  return (
    <div className="space-y-3" data-no-unsaved-mark="true">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={cn(fieldClass, "min-w-0 flex-1 py-2")}
          placeholder="Tên gợi nhớ (vd. Trợ lý BA đơn vị)"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="button" className="px-3 py-2 text-sm" disabled={creating} onClick={onCreate}>
          {creating ? <Loader2 className="size-4 animate-spin" /> : null}
          <span>Tạo mã khóa</span>
        </Button>
      </div>
      {rawToken ? (
        <div className="space-y-2 rounded-xl border border-warning/40 bg-warning/10 p-3">
          <p className="text-xs">
            Mã chỉ hiện <b>một lần</b>. Chép vào biến môi trường bí mật của trợ lý, không lưu vào file.
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-background px-2 py-1 text-xs">{rawToken}</code>
            <Button type="button" variant="ghost" className="px-2 py-1" onClick={onCopy} aria-label="Chép">
              <Copy className="size-4" />
            </Button>
          </div>
          <Button type="button" variant="ghost" className="px-3 py-1 text-xs" onClick={() => setRawToken("")}>
            Đã lưu, ẩn đi
          </Button>
        </div>
      ) : null}
      {isLoading ? <p className="text-xs text-muted-foreground">Đang tải…</p> : null}
      {rows.length ? (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {rows.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
              <span>
                <b>{t.name}</b> · <code>{t.prefix}…</code> · tạo {fmt(t.createdAt)} · dùng gần nhất {fmt(t.lastUsedAt)}
              </span>
              {t.revokedAt ? (
                <span className="text-muted-foreground">Đã thu hồi {fmt(t.revokedAt)}</span>
              ) : (
                <Button variant="dangerGhost" className="px-3 py-1 text-xs" disabled={revoking} onClick={() => onRevoke(t)}>
                  Thu hồi
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : !isLoading ? (
        <p className="text-xs text-muted-foreground">Chưa có mã khóa.</p>
      ) : null}
    </div>
  );
}
