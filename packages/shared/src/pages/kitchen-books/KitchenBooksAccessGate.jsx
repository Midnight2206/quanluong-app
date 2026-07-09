"use client";

export function KitchenBooksAccessGate({ permissionLabel, allowed, children }) {
  if (!allowed) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Bạn chưa có quyền <span className="font-mono">{permissionLabel}</span> để mở mục này.
      </p>
    );
  }
  return children;
}
