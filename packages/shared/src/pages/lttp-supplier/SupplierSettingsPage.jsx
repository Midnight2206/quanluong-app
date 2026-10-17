"use client";

import { ThemePicker } from "@/components/common/ThemeToggle";

export function SupplierSettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 py-6 sm:px-4">
      <h1 className="text-xl font-semibold text-foreground">Cài đặt</h1>
      <ThemePicker className="max-w-xs rounded-xl border border-border bg-card p-4" />
    </div>
  );
}
