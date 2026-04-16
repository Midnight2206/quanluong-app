"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/utils/cn";
import { resolveAvatarUrl } from "@/utils/avatarUrl";

function ToastAvatar({ avatarUrl, isGroup, name }) {
  const initial = String(name ?? "?").trim().charAt(0).toUpperCase() || "?";
  const [broken, setBroken] = useState(false);
  const src = resolveAvatarUrl(avatarUrl);

  if (isGroup) {
    return (
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-bold text-primary"
        aria-hidden
      >
        {initial}
      </div>
    );
  }

  if (broken) {
    return (
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-bold text-muted-foreground">
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className="size-8 shrink-0 rounded-full border border-border object-cover"
      onError={() => setBroken(true)}
    />
  );
}

function ChatIncomingToastBody({ toastId, name, subtitle, preview, avatarUrl, isGroup }) {
  const safeName = String(name ?? "").trim() || "Người gửi";
  const safePreview = String(preview ?? "").trim() || "…";
  const sub = String(subtitle ?? "").trim();

  return (
    <div
      className={cn(
        "pointer-events-auto relative flex w-[min(100vw-1rem,268px)] gap-2 rounded-lg border border-border bg-card py-2 pl-2 pr-7 shadow-md",
        "text-foreground",
      )}
    >
      <button
        type="button"
        className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
        aria-label="Đóng thông báo"
        onClick={() => toast.dismiss(toastId)}
      >
        <X className="size-3.5" />
      </button>
      <ToastAvatar avatarUrl={avatarUrl} isGroup={isGroup} name={safeName} />
      <div className="min-w-0 flex-1 overflow-hidden pr-0.5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Tin nhắn</p>
        <p className="truncate text-xs font-semibold leading-snug text-foreground">{safeName}</p>
        {isGroup && sub ? (
          <p className="truncate text-[10px] text-muted-foreground">Từ {sub}</p>
        ) : null}
        <div className="mt-1 rounded-md border border-border/70 bg-muted/40 px-2 py-1.5">
          <p className="line-clamp-3 break-words text-[11px] leading-snug text-foreground/95">{safePreview}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * @param {string} title
 * @param {{ description?: string, avatarUrl?: string | null, isGroup?: boolean, subtitle?: string } & import('sonner').ExternalToast} [options]
 */
export function notifyChatIncoming(title, options = {}) {
  const { description = "", avatarUrl = null, isGroup = false, subtitle = "", ...toastOptions } = options;

  toast.custom(
    (id) => (
      <ChatIncomingToastBody
        toastId={id}
        name={title}
        subtitle={subtitle}
        preview={description}
        avatarUrl={avatarUrl}
        isGroup={Boolean(isGroup)}
      />
    ),
    {
      position: "top-right",
      duration: 8000,
      unstyled: true,
      className: "!p-0 !bg-transparent !shadow-none",
      ...toastOptions,
    },
  );
}
