"use client";

import { notifyError } from "@/services/notify";

export function notifyNoWritePermission() {
  notifyError("Không có quyền sửa.");
}

export function notifyNoDeletePermission() {
  notifyError("Không có quyền xóa.");
}

export function PermissionSectionDenied() {
  return (
    <p className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
      Không có quyền truy cập.
    </p>
  );
}
