"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDraftPersist } from "@/hooks/useDraftPersist";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { qk } from "@/app/query/queryKeys";
import { Card, CardContent } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { useLttpSupplierCatalogQuery } from "@/features/lttp-supplier/api/lttpSupplierApi";
import { useGetUsersQuery } from "@/features/users/api/usersApi";
import { SuperadminUsersPanel } from "@/pages/dashboard/superadmin/SuperadminUsersPanel";
import {
  useApproveRegistrationMutation,
  useRejectRegistrationMutation,
} from "@/features/registrations/api/registrationsApi";
import { useHasPermission } from "@/features/auth/model/authSlice";
import { notifyError, notifySuccess } from "@/services/notify";
import { cn } from "@/utils/cn";
import { fieldClassSm as inputClass } from "@/utils/fieldClass";

const P_REVIEW = "registrations.review";

const USER_TABS = [
  { id: "list", label: "Danh sách" },
  { id: "create", label: "Tạo người dùng" },
  { id: "review", label: "Duyệt đăng ký" },
];

function registrationBadgeClass(status) {
  switch (status) {
    case "PENDING_APPROVAL":
      return "bg-warning/15 text-warning";
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
  const [tab, setTab] = useState("list");
  const [processingId, setProcessingId] = useState(null);
  const [approveSupplierByUser, setApproveSupplierByUser] = useState({});
  const pendingSupplierReview = users.some(
    (row) =>
      canReviewRegistrations &&
      row.registrationStatus === "PENDING_APPROVAL" &&
      row.type?.name === "lttp_supplier",
  );
  const { data: supplierCatalogData, isError: suppliersError } = useLttpSupplierCatalogQuery({
    skip: !pendingSupplierReview,
  });
  const suppliers = Array.isArray(supplierCatalogData?.suppliers) ? supplierCatalogData.suppliers : [];
  const [rejectNotes, setRejectNotes] = useState({});
  const { draft: rejectDraft, setDraftPayload: persistRejectNotes, ready: rejectPersistReady } =
    useDraftPersist({ draftType: "reject-notes", scopeId: "global" });
  const rejectHydratedRef = useRef(false);
  const rejectReadyRef = useRef(false);

  useLayoutEffect(() => {
    if (!rejectPersistReady || rejectHydratedRef.current) {
      return;
    }
    rejectHydratedRef.current = true;
    if (rejectDraft?.rejectNotes && typeof rejectDraft.rejectNotes === "object") {
      setRejectNotes(rejectDraft.rejectNotes);
    }
    rejectReadyRef.current = true;
  }, [rejectPersistReady, rejectDraft]);

  useEffect(() => {
    if (!rejectReadyRef.current || !rejectPersistReady) {
      return;
    }
    persistRejectNotes({ rejectNotes });
  }, [rejectNotes, rejectPersistReady, persistRejectNotes]);

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

  async function onApprove(user) {
    const supplierPick = user.type?.name === "lttp_supplier";
    const lttpSupplierId = Number(approveSupplierByUser[user.id]);
    if (supplierPick && !(Number.isInteger(lttpSupplierId) && lttpSupplierId > 0)) {
      return;
    }
    setProcessingId(user.id);
    try {
      await approve(supplierPick ? { userId: user.id, lttpSupplierId } : user.id).unwrap();
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
    <section className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.28em] text-muted-foreground">
          Người dùng
        </p>
        <h2 className="text-xl font-semibold">Người dùng trong đơn vị</h2>
      </div>

      <div role="tablist" aria-label="Nghiệp vụ người dùng" className="flex flex-wrap gap-1 border-b border-border">
        {USER_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={cn(
              "border-b-2 px-3 py-2 text-sm",
              tab === item.id
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground",
            )}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "list" ? <SuperadminUsersPanel section="list" /> : null}
      {tab === "create" ? <SuperadminUsersPanel section="create" /> : null}

      {tab === "review" ? (
      <Card>
        <CardContent className="space-y-3" data-local-commit-form="true">
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
                    className="rounded-xl border bg-background px-4 py-4 shadow-soft"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold">
                          {user.profile?.fullName || user.username}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          #{user.id}
                          {user.username ? ` · @${user.username}` : ""}
                          {user.email ? ` · ${user.email}` : ""}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {[user.unit?.name, user.jobTitle?.name, user.profile?.phoneNumber]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </p>
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
                          {user.type?.name === "lttp_supplier" ? (
                            <select
                              className={cn(inputClass, "md:w-64")}
                              aria-label="Đối tác"
                              value={approveSupplierByUser[user.id] ?? ""}
                              onChange={(e) =>
                                setApproveSupplierByUser((prev) => ({
                                  ...prev,
                                  [user.id]: e.target.value,
                                }))
                              }
                            >
                              <option value="">— Chọn đối tác —</option>
                              {suppliers.map((supplier) => (
                                <option key={supplier.id} value={supplier.id}>
                                  {supplier.level1UnitName} — {supplier.name}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          {user.type?.name === "lttp_supplier" && suppliersError ? (
                            <p className="text-xs text-muted-foreground">Không tải được danh sách đối tác.</p>
                          ) : null}
                          <div className="flex flex-wrap gap-1.5">
                            <IconButton
                              label="Duyệt"
                              variant="primary"
                              disabled={
                                processingId != null
                                || (user.type?.name === "lttp_supplier" && !(approveSupplierByUser[user.id] ?? ""))
                              }
                              loading={processingId === user.id && approving}
                              onClick={() => onApprove(user)}
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
      ) : null}
    </section>
  );
}
