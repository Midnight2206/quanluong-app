"use client";

import { MidnightMainPanel } from "./MidnightMainPanel";
import { UnifiedPageScrollRoot } from "@/hocs/withUnifiedPageScroll";

export function MidnightShell() {
  async function onExit() {
    await fetch("/api/midnight-secret/exit", { method: "POST", credentials: "include" });
    window.location.reload();
  }

  return (
    <div
      data-page-scroll-owner="true"
      className="h-dvh overflow-y-auto bg-slate-100 text-slate-900"
    >
      <UnifiedPageScrollRoot>
        <header data-sticky-level="0" className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-3 sm:px-6">
            <div>
              <h1 className="text-sm font-semibold text-slate-800">Báo cáo giá đối tác (nội bộ)</h1>
              <p className="text-xs text-slate-500">Đường dẫn: /midnight-secret</p>
            </div>
            <button
              type="button"
              onClick={() => void onExit()}
              className="text-sm text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
            >
              Rời trang
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-6xl pb-12">
          <MidnightMainPanel />
        </div>
      </UnifiedPageScrollRoot>
    </div>
  );
}
