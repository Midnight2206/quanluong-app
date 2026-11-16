"use client";

import { MidnightMainPanel } from "./MidnightMainPanel";
import { UnifiedPageScrollRoot } from "@/hocs/withUnifiedPageScroll";

export function MidnightShell({ grants }) {
  async function onExit() {
    await fetch("/api/midnight-secret/exit", { method: "POST", credentials: "include" });
    window.location.reload();
  }

  return (
    <div data-page-scroll-owner="true" className="h-dvh overflow-y-auto bg-background text-foreground">
      <UnifiedPageScrollRoot>
        <header
          data-sticky-level="0"
          className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-md"
        >
          <div className="mx-auto flex h-12 max-w-[100rem] items-center justify-between gap-3 px-3 sm:px-4 lg:px-5">
            <h1 className="truncate text-sm font-semibold tracking-tight">Báo cáo nội bộ</h1>
            <button
              type="button"
              onClick={() => void onExit()}
              className="shrink-0 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Rời trang
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-[100rem] px-3 pb-8 pt-3 sm:px-4 lg:px-5">
          <MidnightMainPanel grants={grants} />
        </div>
      </UnifiedPageScrollRoot>
    </div>
  );
}
