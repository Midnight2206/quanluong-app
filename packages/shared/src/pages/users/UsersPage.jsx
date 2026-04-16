"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { qk } from "@/app/query/queryKeys";
import { Card, CardContent } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { useGetUsersQuery } from "@/features/users/api/usersApi";
import {
  useApproveRegistrationMutation,
  useRejectRegistrationMutation,
} from "@/features/registrations/api/registrationsApi";
import { useHasPermission } from "@/features/auth/model/authSlice";
import { notifyError, notifySuccess } from "@/services/notify";
import { cn } from "@/utils/cn";

const P_REVIEW = "registrations.review";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

function registrationBadgeClass(status) {
  switch (status) {
    case "PENDING_APPROVAL":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-200";
    case "REJECTED":
      return "bg-destructive/15 text-destructive";
    case "APPROVED":
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

function registrationLabel(status) {
  switch (status) {
    case "PENDING_APPROVAL":
      return "Chờ duyệt";
    case "REJECTED":
      return "Từ chối";
    case "APPROVED":
      return "Đã duyệt";
    default:
      return status || "—";
  }
}

/**
 * @param {{ initialUsers?: unknown[], initialUsersError?: boolean }} props
 * Khi truyền `initialUsers` (kể cả []), danh sách lấy từ server; sau mutation gọi `router.refresh()`.
 */
export function UsersPage({ initialUsers, initialUsersError = false } = {}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const hydrateFromServer = initialUsers !== undefined;
  const canReviewRegistrations = useHasPermission(P_REVIEW);
  const rtk = useGetUsersQuery(undefined, { skip: hydrateFromServer });
  const users = hydrateFromServer
    ? Array.isArray(initialUsers)
      ? initialUsers
      : []
    : (rtk.data ?? []);
  const isLoading = hydrateFromServer ? false : rtk.isLoading;
  const isError = hydrateFromServer ? Boolean(initialUsersError) : rtk.isError;
  const errorToastSent = useRef(false);
  const [approve, { isLoading: approving }] = useApproveRegistrationMutation();
  const [reject, { isLoading: rejecting }] = useRejectRegistrationMutation();
  const [processingId, setProcessingId] = useState(null);
  const [rejectNotes, setRejectNotes] = useState({});

  function refetchListsAfterRegistrationReview() {
    if (hydrateFromServer) {
      router.refresh();
    } else {
      queryClient.invalidateQueries({ queryKey: qk.users.list() });
    }
    queryClient.invalidateQueries({ queryKey: qk.jobTitles.list() });
  }

  useEffect(() => {
    if (!isError) {
      errorToastSent.current = false;
      return;
    }
    if (errorToastSent.current) {
      return;
    }
    errorToastSent.current = true;
    notifyError("Không tải được danh sách người dùng. Kiểm tra quyền hoặc backend.");
  }, [isError]);

  async function onApprove(userId) {
    setProcessingId(userId);
    try {
      await approve(userId).unwrap();
      refetchListsAfterRegistrationReview();
      notifySuccess("Đã duyệt đăng ký.");
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
      refetchListsAfterRegistrationReview();
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
    <section className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-y-contain">
      <div>
        <p className="text-sm uppercase tracking-[0.28em] text-muted-foreground">
          Người dùng
        </p>
        <h2 className="text-2xl font-semibold">Danh sách người dùng</h2>
      </div>

      <Card>
        <CardContent className="space-y-3">
          {isLoading ? <p className="text-sm text-muted-foreground">Đang tải người dùng...</p> : null}
          {!isLoading && !isError ? (
            <div className="space-y-3">
              {users.map((user) => {
                const status = user.registrationStatus;
                const showActions =
                  canReviewRegistrations && status === "PENDING_APPROVAL";
                return (
                  <div
                    key={user.id}
                    className="rounded-2xl border bg-background px-4 py-4 shadow-soft"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold">
                          {user.profile?.fullName || user.username}
                        </h3>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {user.type?.name || "unknown"}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-medium",
                              registrationBadgeClass(status),
                            )}
                          >
                            Đăng ký: {registrationLabel(status)}
                          </span>
                          {user.isActive === false && status !== "REJECTED" ? (
                            <span className="text-[11px] text-muted-foreground">Chưa kích hoạt</span>
                          ) : null}
                        </div>
                      </div>
                      {showActions ? (
                        <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-[12rem] md:items-end">
                          <div className="flex flex-wrap gap-1.5">
                            <IconButton
                              label="Duyệt"
                              variant="primary"
                              disabled={processingId != null}
                              loading={processingId === user.id && approving}
                              onClick={() => onApprove(user.id)}
                            >
                              <Check strokeWidth={2} aria-hidden />
                            </IconButton>
                            <IconButton
                              label="Từ chối"
                              variant="danger"
                              disabled={processingId != null}
                              loading={processingId === user.id && rejecting}
                              onClick={() => onReject(user.id)}
                            >
                              <X strokeWidth={2} aria-hidden />
                            </IconButton>
                          </div>
                          <input
                            className={inputClass}
                            value={rejectNotes[user.id] ?? ""}
                            onChange={(e) =>
                              setRejectNotes((prev) => ({ ...prev, [user.id]: e.target.value }))
                            }
                            placeholder="Ghi chú từ chối (tuỳ chọn)"
                            maxLength={500}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
