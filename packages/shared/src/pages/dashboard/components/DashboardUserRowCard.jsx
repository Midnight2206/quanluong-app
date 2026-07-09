"use client";

import { Power } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

/**
 * Thẻ người dùng — danh sách Người dùng dashboard trên màn hình hẹp.
 */
export function DashboardUserRowCard({
  user,
  isPatching,
  togglingUserId,
  onToggleActive,
}) {
  const displayName = user.profile?.fullName || user.username;

  return (
    <article className="-mx-3 rounded-none border-x-0 border-y border-border/70 bg-card/40 p-3 shadow-sm first:border-t sm:mx-0 sm:rounded-xl sm:border sm:border-border/70">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <span
          className="shrink-0 rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground"
          aria-label={user.isActive ? "Đang hoạt động" : "Đã vô hiệu"}
        >
          {user.isActive ? "HT" : "—"}
        </span>
      </div>

      <dl className="mt-2 space-y-1 text-[11px]">
        <div className="flex gap-2">
          <dt className="shrink-0 text-muted-foreground">Vai trò</dt>
          <dd className="min-w-0 flex-1 text-right capitalize text-foreground">
            {user.type?.name ?? "—"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-muted-foreground">Đơn vị</dt>
          <dd className="min-w-0 flex-1 truncate text-right text-foreground">
            {user.unit?.name ?? "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex justify-end border-t border-border/60 pt-3">
        <IconButton
          label={user.isActive ? "Vô hiệu" : "Kích hoạt"}
          variant={user.isActive ? "danger" : "primary"}
          disabled={isPatching || togglingUserId != null}
          loading={togglingUserId === user.id}
          onClick={() => onToggleActive(user)}
        >
          <Power aria-hidden />
        </IconButton>
      </div>
    </article>
  );
}
