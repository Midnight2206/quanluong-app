"use client";

import Link from "next/link";
import { useMemo } from "react";
import { TabPanel } from "@/components/common/TabPanel";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/utils/cn";
import { ChungTuCategoryWorkspace } from "./ChungTuCategoryWorkspace.jsx";
import { ChungTuPlaceholderWorkspace } from "./ChungTuPlaceholderWorkspace.jsx";
import {
  CHUNG_TU_CATEGORY_CONFIG_LIST,
  DEFAULT_CHUNG_TU_CATEGORY_KEY,
} from "./chungTuCategoryConfig";
import { CHUNG_TU_DOC_TAB_STATUS } from "./chungTuQuyetToanTabsMeta";

export function ChungTuQuyetToanPage() {
  const tabs = useMemo(
    () =>
      CHUNG_TU_CATEGORY_CONFIG_LIST.map((config) => {
        const isAvailable = config.status === CHUNG_TU_DOC_TAB_STATUS.AVAILABLE;
        return {
          id: config.categoryKey,
          label: config.label,
          panel: isAvailable ? (
            <ChungTuCategoryWorkspace categoryKey={config.categoryKey} />
          ) : (
            <ChungTuPlaceholderWorkspace
              label={config.label}
              subtitle={config.subtitle}
              hint={config.hint}
            />
          ),
        };
      }),
    [],
  );

  return (
    <section className="min-w-0 space-y-3 pb-6">
      <Card className="shadow-soft">
        <CardContent className="p-0">
          <TabPanel
            persistId="chungtu-doc-type-tabs-v1"
            defaultTabId={DEFAULT_CHUNG_TU_CATEGORY_KEY}
            scrollablePanel={false}
            scrollableTabList
            stickyTabList
            stickyTabListLevel={0}
            fullBleedInCard
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
