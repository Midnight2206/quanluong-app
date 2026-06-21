"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  useGetLttpRecipientUsersQuery,
  useGetLttpReceivingDefaultRecipientsListQuery,
  usePutLttpReceivingDefaultRecipientMutation,
} from "@/features/lttp/api/lttpApi";
import { notifyError, notifySuccess } from "@/services/notify";

const inputClass =
  "w-full min-w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

/**
 * Một dòng: **đơn vị nhận** + chọn user mặc định (lưu vào bảng theo recipientUnitId).
 */
function BulkRecipientRow({ unit, initialUserId, canWrite }) {
  const [recipientUserId, setRecipientUserId] = useState(() =>
    initialUserId != null && initialUserId !== "" ? String(initialUserId) : "",
  );

  useEffect(() => {
    setRecipientUserId(
      initialUserId != null && initialUserId !== ""
        ? String(initialUserId)
        : "",
    );
  }, [initialUserId, unit.id]);

  const { data: recipientUsers = [], isLoading: usersLoad } =
    useGetLttpRecipientUsersQuery(unit.id, {
      staleTime: 5 * 60 * 1000,
    });
  const [putDefault, { isLoading: saving }] =
    usePutLttpReceivingDefaultRecipientMutation();

  const saveRow = useCallback(async () => {
    if (!canWrite) {
      return;
    }
    try {
      await putDefault({
        recipientUnitId: unit.id,
        userId: recipientUserId ? Number(recipientUserId) : null,
      });
      notifySuccess("Đã lưu người nhận mặc định cho đơn vị nhận.");
    } catch (err) {
      notifyError(
        err?.data?.message || err?.message || "Lưu không thành công.",
      );
    }
  }, [canWrite, putDefault, recipientUserId, unit.id]);

  return (
    <tr className="border-b border-border/50 align-middle">
      <td className="px-2 py-2 text-[11px] font-medium">{unit.name}</td>
      <td className="px-2 py-1.5">
        <select
          className={inputClass}
          value={recipientUserId}
          onChange={(e) => setRecipientUserId(e.target.value)}
          disabled={usersLoad}
        >
          <option value="">— Chọn người nhận —</option>
          {recipientUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName || u.username}
            </option>
          ))}
        </select>
      </td>
      <td className="w-24 px-2 py-1.5 text-right">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 text-[10px]"
          disabled={!canWrite || saving || usersLoad}
          onClick={saveRow}
        >
          {saving ? <Loader2 className="size-3 animate-spin" /> : null}
          Lưu
        </Button>
      </td>
    </tr>
  );
}

/**
 * Modal: mỗi dòng = **đơn vị nhận** + chọn user mặc định (không theo kho cấp).
 */
export function LttpNguoiNhanBulkModal({ open, onClose, units, canWrite }) {
  const titleId = useId();
  const { data: listPayload, isLoading: listLoad } =
    useGetLttpReceivingDefaultRecipientsListQuery({
      skip: !open,
    });

  const userIdByRecipient = useMemo(() => {
    const m = new Map();
    for (const it of listPayload?.items ?? []) {
      m.set(it.recipientUnitId, it.userId);
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
              Người nhận mặc định theo đơn vị nhận
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Named range <span className="font-mono">nguoiNhanHang</span> = user mặc định;{" "}
              <span className="font-mono">donVi</span> = tên đơn vị nhận (cột trái).
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
                  <th className="px-2 py-2">Đơn vị nhận (LTTP)</th>
                  <th className="px-2 py-2">Người nhận mặc định</th>
                  <th className="w-20 px-2 py-2 text-right">Lưu</th>
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
                    <BulkRecipientRow
                      key={u.id}
                      unit={u}
                      canWrite={canWrite}
                      initialUserId={userIdByRecipient.get(u.id)}
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
