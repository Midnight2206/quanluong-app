"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  useGetLttpBuyerUsersQuery,
  usePutLttpWarehouseBuyerMutation,
  useRewriteLttpWarehouseBuyerMutation,
} from "@/features/lttp/api/lttpBuyerDefaultsApi";
import { useConfirm } from "@/contexts/ConfirmProvider";
import { notifyError, notifySuccess } from "@/services/notify";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function LttpWarehouseBuyerCard({ unitId, unitLabel }) {
  const { confirm } = useConfirm();
  const [userId, setUserId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(() => localYmd());
  const { data: users = [], isLoading } = useGetLttpBuyerUsersQuery(unitId, {
    staleTime: 5 * 60 * 1000,
  });
  const [putBuyer, { isLoading: saving }] = usePutLttpWarehouseBuyerMutation();
  const [rewriteAll, { isLoading: rewriting }] = useRewriteLttpWarehouseBuyerMutation();
  const busy = saving || rewriting;
  const selected = users.find((u) => String(u.id) === String(userId));
  const selectedName = selected?.fullName || selected?.username || "";

  async function saveTerm() {
    if (!userId || !effectiveDate) return;
    try {
      const data = await putBuyer({
        unitId,
        userId: Number(userId),
        effectiveDate,
      });
      const count = data?.slipsUpdated ?? 0;
      notifySuccess(
        count > 0
          ? `Đã áp dụng ${selectedName} cho ${count} phiếu từ ${effectiveDate}.`
          : `Đã lưu ${selectedName} từ ${effectiveDate}. Phiếu trước ngày này giữ người mua cũ.`,
      );
    } catch (err) {
      notifyError(err?.data?.message || err?.message || "Lưu không thành công.");
    }
  }

  async function rewriteEverySlip() {
    if (!userId) return;
    const ok = await confirm({
      title: "Gán người mua cho mọi phiếu cũ",
      message: `Gán ${selectedName} cho toàn bộ phiếu đã phát hành của kho này, kể cả phiếu trước mốc ngày. Nút này sẽ bỏ ở bản cập nhật sau.`,
      confirmLabel: "Gán tất cả",
    });
    if (!ok) return;
    try {
      const data = await rewriteAll({ unitId, userId: Number(userId) });
      notifySuccess(`Đã gán ${selectedName} cho ${data?.slipsUpdated ?? 0} phiếu.`);
    } catch (err) {
      notifyError(err?.data?.message || err?.message || "Gán không thành công.");
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-card/50 p-3">
      <p className="text-xs font-medium text-foreground">
        Người mua kho {unitLabel ? `«${unitLabel}»` : ""}
      </p>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Mỗi kho một người mua, chọn user thuộc đúng kho này. Phiếu từ ngày đã chọn lấy người mua mới;
        phiếu trước ngày đó giữ người mua cũ.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[12rem] flex-1 space-y-0.5 text-[10px] text-muted-foreground">
          User của kho
          <select
            className={inputClass}
            value={userId}
            disabled={isLoading || busy}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">{isLoading ? "Đang tải…" : "— Chọn user —"}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName || u.username}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-0.5 text-[10px] text-muted-foreground">
          Áp dụng từ ngày
          <input
            type="date"
            className={inputClass}
            value={effectiveDate}
            disabled={busy}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </label>
        <Button type="button" className="h-8 px-3 text-xs" disabled={!userId || !effectiveDate || busy} onClick={saveTerm}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Lưu mốc"}
        </Button>
        <Button
          type="button"
          variant="dangerGhost"
          className="h-8 px-3 text-xs"
          disabled={!userId || busy}
          onClick={rewriteEverySlip}
        >
          {rewriting ? <Loader2 className="size-3.5 animate-spin" /> : "Tạm: gán mọi phiếu cũ"}
        </Button>
      </div>
    </div>
  );
}
