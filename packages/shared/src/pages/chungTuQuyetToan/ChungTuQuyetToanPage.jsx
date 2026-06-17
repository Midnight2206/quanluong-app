"use client";

import Link from "next/link";
import { useMemo } from "react";
import { TabPanel } from "@/components/common/TabPanel";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/utils/cn";
import { ChungTuDocumentWorkspace } from "./ChungTuDocumentWorkspace.jsx";
import { ChungTuPlaceholderWorkspace } from "./ChungTuPlaceholderWorkspace.jsx";
import {
  CHUNG_TU_DOC_TAB_STATUS,
  CHUNG_TU_QUYET_TOAN_DOCUMENT_TABS,
  DEFAULT_CHUNG_TU_DOC_TAB_ID,
} from "./chungTuQuyetToanTabsMeta.js";

const PLANNED_TAB_BADGE = (
  <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[10px]">
    Sắp có
  </span>
);

function renderWorkspaceForTab(meta) {
  if (meta.status === CHUNG_TU_DOC_TAB_STATUS.AVAILABLE && meta.mode) {
    return (
      <ChungTuDocumentWorkspace
        categoryKey={meta.id}
        mode={meta.mode}
        subtitle={meta.subtitle}
      />
    );
  }
  return (
    <ChungTuPlaceholderWorkspace
      label={meta.label}
      subtitle={meta.subtitle}
      hint={meta.hint}
    />
  );
}

export function ChungTuQuyetToanPage() {
  const tabs = useMemo(
    () =>
      CHUNG_TU_QUYET_TOAN_DOCUMENT_TABS.map((meta) => ({
        id: meta.id,
        label: meta.label,
        badge:
          meta.status === CHUNG_TU_DOC_TAB_STATUS.PLANNED
            ? PLANNED_TAB_BADGE
            : undefined,
        panel: renderWorkspaceForTab(meta),
      })),
    [],
  );

  const tabSummary = useMemo(
    () => CHUNG_TU_QUYET_TOAN_DOCUMENT_TABS.map((t) => t.label).join(" · "),
    [],
  );

  return (
    <section className="min-w-0 space-y-3 pb-6">
      <div className="space-y-2">
        <h1 className="text-base font-semibold tracking-tight sm:text-lg">
          Chứng từ quyết toán
        </h1>
      </div>

      <Card className="shadow-soft overflow-hidden">
        <CardContent className="p-0">
          <TabPanel
            persistId="chungtu-document-tabs-v2"
            defaultTabId={DEFAULT_CHUNG_TU_DOC_TAB_ID}
            equalWidthTabs={false}
            scrollablePanel={false}
            stickyTabList
            fullBleedInCard
            stickyTabListTopClassName="top-0"
            tabs={tabs}
          />
        </CardContent>
      </Card>

      <Link
        href="/"
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg border-2 border-border/90 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition print:hidden hover:bg-muted/90 hover:border-primary/35",
        )}
      >
        Về trang chủ
      </Link>
    </section>
  );
}
