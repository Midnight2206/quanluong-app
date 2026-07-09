"use client";

import Link from "next/link";
import { HardDrive } from "lucide-react";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import { cn } from "@/utils/cn";

/**
 * Nhắc liên kết Google Drive trước khi dùng mẫu chứng từ.
 * @param {{ className?: string }} props
 */
export function ChungTuDriveLinkNotice({ className }) {
  const user = useCurrentUser();
  if (user?.googleDriveFolderId) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5",
        className,
      )}
      role="status"
    >
      <div className="flex min-w-0 items-center gap-2">
        <HardDrive className="size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
        <p className="text-xs font-medium text-amber-950 dark:text-amber-50">
          Cần liên kết Google Drive để chọn mẫu chứng từ.
        </p>
      </div>
      <Link
        href="/"
        className={cn(
          "inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-amber-800/30 bg-amber-500/90 px-3 py-1.5 text-xs font-semibold text-amber-950 transition",
          "hover:bg-amber-400/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60",
        )}
      >
        Liên kết Drive
      </Link>
    </div>
  );
}
