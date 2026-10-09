"use client";

import { ThemeToggle } from "@/components/common/ThemeToggle";

export function SupplierSettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 py-6 sm:px-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Cài đặt</h1>
        <p className="text-sm text-muted-foreground">
          Chế độ sáng và tối lưu trên trình duyệt này, cùng token giao diện của hệ thống.
        </p>
      </div>
      <ThemeToggle />
    </div>
  );
}
