"use client";

import { useEffect, useRef } from "react";
import { WifiOff } from "lucide-react";
import { notifyWarning } from "@/services/notify";

export function OfflineBanner({ online }) {
  const wasOnlineRef = useRef(online);

  useEffect(() => {
    const was = wasOnlineRef.current;
    wasOnlineRef.current = online;
    if (was && !online) {
      notifyWarning(
        "Mất kết nối mạng. Thay đổi chỉ lưu tạm trên máy này cho đến khi có mạng lại.",
      );
    }
  }, [online]);

  if (online) {
    return null;
  }

  return (
    <div
      className="fixed inset-x-0 top-0 z-[46] flex items-center justify-center gap-2 border-b border-amber-500/40 bg-amber-500/95 px-3 py-2 text-center text-xs font-medium text-amber-950 shadow-sm print:hidden dark:border-amber-400/35 dark:bg-amber-600/95 dark:text-amber-50"
      role="status"
      aria-live="assertive"
    >
      <WifiOff className="size-3.5 shrink-0" aria-hidden />
      <span>
        Bạn đang offline — dữ liệu mới chỉ lưu tạm trên máy này, chưa lên máy chủ. Khi có mạng sẽ
        đồng bộ (nếu đã xếp hàng gửi).
      </span>
    </div>
  );
}
