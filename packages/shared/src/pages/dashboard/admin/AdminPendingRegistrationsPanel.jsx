"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { qk } from "@/app/query/queryKeys";
import { IconButton } from "@/components/ui/IconButton";
import { Card, CardContent } from "@/components/ui/Card";
import {
  useApproveRegistrationMutation,
  useGetPendingRegistrationsQuery,
  useRejectRegistrationMutation,
} from "@/features/registrations/api/registrationsApi";
import { useHasPermission } from "@/features/auth/model/authSlice";
import { notifyError, notifySuccess } from "@/services/notify";

const P_READ = "registrations.read";
const P_REVIEW = "registrations.review";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

export function AdminPendingRegistrationsPanel() {
  const queryClient = useQueryClient();
  const canRead = useHasPermission(P_READ);
  const canReview = useHasPermission(P_REVIEW);
  const { data: pending = [], isLoading, isError, isFetching } = useGetPendingRegistrationsQuery(
    undefined,
    { skip: !canRead },
  );
  const [approve, { isLoading: approving }] = useApproveRegistrationMutation();
  const [reject, { isLoading: rejecting }] = useRejectRegistrationMutation();
  const [rejectNotes, setRejectNotes] = useState({});
  const [processingId, setProcessingId] = useState(null);

  if (!canRead) {
    return (
      <Card className="shadow-soft">
        <CardContent className="!p-3 sm:!p-4">
          <p className="text-xs text-muted-foreground">
            Tài khoản của bạn không có quyền xem đăng ký chờ duyệt.
          </p>
        </CardContent>
      </Card>
    );
  }

  function refetchListsForJobTitlesTab() {
    queryClient.invalidateQueries({ queryKey: qk.users.list() });
    queryClient.invalidateQueries({ queryKey: qk.jobTitles.list() });
  }

  async function onApprove(userId) {
    setProcessingId(userId);
    try {
      await approve(userId).unwrap();
      refetchListsForJobTitlesTab();
      notifySuccess("Đã duyệt đăng ký. Người dùng có thể đăng nhập.");
    } catch (e) {
      notifyError(e?.data?.message || "Không duyệt được.");
    } finally {
      setProcessingId(null);
    }
  }

  async function onReject(userId) {
    const note = rejectNotes[userId]?.trim() || undefined;
    setProcessingId(userId);
    try {
      await reject({ userId, note }).unwrap();
      refetchListsForJobTitlesTab();
      notifySuccess("Đã từ chối đăng ký.");
      setRejectNotes((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } catch (e) {
      notifyError(e?.data?.message || "Không từ chối được.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <Card className="shadow-soft flex min-h-0 flex-1 flex-col overflow-hidden">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 !px-0 !py-3 sm:!p-4">
        <div className="px-3 sm:px-0">
          <p className="text-xs font-medium sm:text-sm">Đăng ký chờ duyệt</p>
          <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
            Chỉ hiển thị tài khoản người dùng đã đăng ký vào đơn vị trong phạm vi bạn quản lý. Sau khi duyệt, tài khoản
            được kích hoạt và có thể đăng nhập.
          </p>
        </div>

        {isError ? (
          <p className="px-3 text-xs text-destructive sm:px-0">Không tải được danh sách (kiểm tra quyền hoặc mạng).</p>
        ) : null}

        {isLoading ? <p className="px-3 text-xs text-muted-foreground sm:px-0">Đang tải…</p> : null}

        {!isLoading && !isError && pending.length === 0 ? (
          <p className="mx-3 rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-xs text-muted-foreground sm:mx-0">
            Hiện không có đăng ký nào chờ duyệt trong phạm vi của bạn.
          </p>
        ) : null}

        <div className="min-h-0 flex-1 space-y-0 overflow-y-auto overscroll-y-contain px-3 sm:space-y-3 sm:px-0">
          {pending.map((u) => (
            <div
              key={u.id}
              className="-mx-3 rounded-none border-x-0 border-y border-border/70 bg-card px-3 py-3 shadow-soft first:border-t sm:mx-0 sm:rounded-xl sm:border sm:border-border/70 sm:px-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {u.profile?.fullName || u.username}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Đơn vị đăng ký:{" "}
                    <span className="font-medium text-foreground">{u.unit?.name ?? "—"}</span>
                  </p>
                </div>
                {canReview ? (
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    <div className="flex flex-wrap gap-1.5">
                      <IconButton
                        label="Duyệt"
                        variant="primary"
                        disabled={processingId != null || isFetching}
                        loading={processingId === u.id && approving}
                        onClick={() => onApprove(u.id)}
                      >
                        <Check strokeWidth={2} aria-hidden />
                      </IconButton>
                      <IconButton
                        label="Từ chối"
                        variant="danger"
                        disabled={processingId != null || isFetching}
                        loading={processingId === u.id && rejecting}
                        onClick={() => onReject(u.id)}
                      >
                        <X strokeWidth={2} aria-hidden />
                      </IconButton>
                    </div>
                    <label className="block w-full min-w-[12rem] max-w-xs sm:text-right">
                      <span className="mb-0.5 block text-[10px] text-muted-foreground sm:text-left">
                        Ghi chú từ chối (tuỳ chọn)
                      </span>
                      <input
                        className={inputClass}
                        value={rejectNotes[u.id] ?? ""}
                        onChange={(e) =>
                          setRejectNotes((prev) => ({ ...prev, [u.id]: e.target.value }))
                        }
                        placeholder="Lý do ngắn gọn…"
                        maxLength={500}
                      />
                    </label>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Bạn chỉ xem được danh sách, không có quyền duyệt.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
