import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  useGetLttpBuyerDefaultsListQuery,
  useGetLttpBuyerUsersQuery,
  usePutLttpBuyerDefaultMutation,
} from "@/features/lttp/api/lttpBuyerDefaultsApi";
import { notifyError, notifySuccess } from "@/services/notify";

const inputClass =
  "w-full min-w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

/**
 * Một dòng: **đơn vị kho** + chọn user người mua → lưu mặc định & gán toàn bộ phiếu.
 */
function BulkBuyerRow({ unit, initialUserId, canWrite }) {
  const [buyerUserId, setBuyerUserId] = useState(() =>
    initialUserId != null && initialUserId !== "" ? String(initialUserId) : "",
  );

  useEffect(() => {
    setBuyerUserId(
      initialUserId != null && initialUserId !== ""
        ? String(initialUserId)
        : "",
    );
  }, [initialUserId, unit.id]);

  const { data: unitUsers = [], isLoading: usersLoad, isError: usersError } =
    useGetLttpBuyerUsersQuery(unit.id, {
      staleTime: 5 * 60 * 1000,
    });
  const [putDefault, { isLoading: saving }] = usePutLttpBuyerDefaultMutation();

  const saveRow = useCallback(async () => {
    if (!canWrite) {
      return;
    }
    try {
      const data = await putDefault({
        unitId: unit.id,
        userId: buyerUserId ? Number(buyerUserId) : null,
        applyToAllSlips: true,
      });
      const count = data?.slipsUpdated ?? 0;
      if (buyerUserId) {
        notifySuccess(
          count > 0
            ? `Đã gán người mua cho ${count} phiếu xuất của «${unit.name}».`
            : `Đã lưu người mua mặc định cho «${unit.name}» (chưa có phiếu nào).`,
        );
      } else {
        notifySuccess(
          count > 0
            ? `Đã xóa người mua trên ${count} phiếu của «${unit.name}».`
            : `Đã xóa cấu hình người mua mặc định cho «${unit.name}».`,
        );
      }
    } catch (err) {
      notifyError(
        err?.data?.message || err?.message || "Lưu không thành công.",
      );
    }
  }, [canWrite, putDefault, buyerUserId, unit.id, unit.name]);

  return (
    <tr className="border-b border-border/50 align-middle">
      <td className="px-2 py-2 text-[11px] font-medium">{unit.name}</td>
      <td className="px-2 py-1.5">
        <select
          className={inputClass}
          value={buyerUserId}
          onChange={(e) => setBuyerUserId(e.target.value)}
          disabled={usersLoad}
        >
          <option value="">
            {usersLoad
              ? "Đang tải…"
              : usersError
                ? "Không tải được danh sách"
                : unitUsers.length === 0
                  ? "— Không có user trong nhánh kho —"
                  : "— Chưa chọn —"}
          </option>
          {unitUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName || u.username}
            </option>
          ))}
        </select>
      </td>
      <td className="w-28 px-2 py-1.5 text-right">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 text-[10px]"
          disabled={!canWrite || saving || usersLoad}
          onClick={saveRow}
        >
          {saving ? <Loader2 className="size-3 animate-spin" /> : null}
          Lưu &amp; áp dụng
        </Button>
      </td>
    </tr>
  );
}

/**
 * Modal: chọn người mua theo đơn vị kho và gán cho toàn bộ phiếu xuất đã lưu.
 */
export function LttpNguoiMuaBulkModal({ open, onClose, units, canWrite }) {
  const titleId = useId();
  const { data: listPayload, isLoading: listLoad } =
    useGetLttpBuyerDefaultsListQuery({
      skip: !open,
    });

  const userIdByUnit = useMemo(() => {
    const m = new Map();
    for (const it of listPayload?.items ?? []) {
      m.set(it.unitId, it.userId);
    }
    return m;
  }, [listPayload?.items]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function onKey(e) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-background/80 backdrop-blur-[1px]"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-dvh w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-lg sm:max-h-[44rem] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border bg-card px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p id={titleId} className="text-sm font-semibold text-foreground">
              Người mua hàng theo đơn vị kho
            </p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
              Chọn user rồi bấm «Lưu &amp; áp dụng» — hệ thống lưu mặc định cho phiếu
              mới và gán cho <span className="font-medium text-foreground">toàn bộ</span>{" "}
              phiếu xuất hiện có của đơn vị đó. Chứng từ BKMH cần đồng bộ lại sau khi đổi.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="overflow-x-auto p-3 sm:p-4">
            {listLoad ? (
              <p className="px-2 py-4 text-[11px] text-muted-foreground">
                <Loader2 className="inline size-3.5 animate-spin" /> Đang tải
                cấu hình…
              </p>
            ) : null}
            <table className="w-full border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-border text-[9px] uppercase text-muted-foreground">
                  <th className="px-2 py-2">Đơn vị kho (LTTP)</th>
                  <th className="px-2 py-2">Người mua hàng</th>
                  <th className="w-28 px-2 py-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {units.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-4 text-muted-foreground">
                      Không có danh sách đơn vị.
                    </td>
                  </tr>
                ) : (
                  units.map((u) => (
                    <BulkBuyerRow
                      key={u.id}
                      unit={u}
                      canWrite={canWrite}
                      initialUserId={userIdByUnit.get(u.id)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
