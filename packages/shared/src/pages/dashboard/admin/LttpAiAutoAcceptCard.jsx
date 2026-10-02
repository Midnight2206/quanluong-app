"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  useGetLttpAiAutoAcceptQuery,
  usePutLttpAiAutoAcceptMutation,
} from "@/features/lttp/api/lttpBuyerDefaultsApi";
import { notifyError, notifySuccess } from "@/services/notify";

const inputClass =
  "w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

function suggestionText(suggestion) {
  const samples = suggestion?.samples ?? 0;
  if (!suggestion?.ready) {
    return "Danh mục kho chưa có mẫu đã học. Giữ 100% để AI không tự chốt mã.";
  }
  if (suggestion.from === suggestion.to) {
    return `Mẫu đã học của danh mục: ${samples}. Mức gợi ý ${suggestion.from}%.`;
  }
  return `Mẫu đã học của danh mục: ${samples}. Khoảng gợi ý ${suggestion.from}%–${suggestion.to}%.`;
}

export function LttpAiAutoAcceptCard({ unitId, unitLabel }) {
  const { data, isLoading } = useGetLttpAiAutoAcceptQuery(unitId);
  const [putPercent, { isLoading: saving }] = usePutLttpAiAutoAcceptMutation();
  const [percent, setPercent] = useState("100");

  useEffect(() => {
    setPercent(data?.percent == null ? "100" : String(data.percent));
  }, [data?.percent, unitId]);

  async function save(next) {
    try {
      await putPercent({ unitId, percent: next });
      notifySuccess(
        next >= 100
          ? "Mức 100%: AI không tự chốt mã."
          : `AI tự chốt mã khi điểm cao hơn ${next}%.`,
      );
    } catch (err) {
      notifyError(err?.data?.message || err?.message || "Lưu không thành công.");
    }
  }

  function saveTyped() {
    const next = Number(percent);
    if (!Number.isInteger(next) || next < 50 || next > 100) {
      notifyError("Nhập mức từ 50 đến 100.");
      return;
    }
    void save(next);
  }

  const suggested = data?.suggestion?.ready ? data.suggestion.from : null;

  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-card/50 p-3">
      <p className="text-xs font-medium text-foreground">
        AI tự chốt mã {unitLabel ? `«${unitLabel}»` : ""}
      </p>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Dòng có điểm cao hơn mức này thì AI giữ mã, không bắt chọn SKU. Mức 100% không tự chốt dòng nào.
        Khoảng gợi ý theo số mẫu tên và số lượng danh mục kho đã học, không theo từng phiếu đặt trước.
      </p>
      <p className="text-[11px] leading-snug text-muted-foreground">{suggestionText(data?.suggestion)}</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground">
          Mức điểm
          <input
            className={`${inputClass} ml-2`}
            inputMode="numeric"
            value={percent}
            placeholder="100"
            disabled={isLoading || saving}
            onChange={(e) => setPercent(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
          />
          <span className="ml-1">%</span>
        </label>
        <Button type="button" onClick={saveTyped} disabled={isLoading || saving}>
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          Lưu
        </Button>
        {suggested != null ? (
          <Button type="button" variant="outline" disabled={saving} onClick={() => void save(suggested)}>
            Dùng {suggested}%
          </Button>
        ) : null}
      </div>
    </div>
  );
}
