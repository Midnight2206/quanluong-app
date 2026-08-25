"use client";

import { useMemo } from "react";
import { TabPanel } from "@/components/common/TabPanel";
import { CHUNG_TU_CATEGORY_CONFIG_LIST } from "@/pages/chungTuQuyetToan/chungTuCategoryConfig";
import { CHUNG_TU_DOC_TAB_STATUS } from "@/pages/chungTuQuyetToan/chungTuQuyetToanTabsMeta";
import { SuperadminChungTuPdfCategoryTemplates } from "./SuperadminChungTuPdfCategoryTemplates";

export function SuperadminChungTuPdfTemplatesPanel() {
  const tabs = useMemo(
    () =>
      CHUNG_TU_CATEGORY_CONFIG_LIST.filter(
        (c) => c.status === CHUNG_TU_DOC_TAB_STATUS.AVAILABLE,
      ).map((c) => ({
        id: c.categoryKey,
        label: c.label,
        panel: <SuperadminChungTuPdfCategoryTemplates categoryKey={c.categoryKey} />,
      })),
    [],
  );

  return (
    <TabPanel
      persistId="sa-chungtu-pdf-templates"
      defaultTabId={tabs[0]?.id}
      scrollableTabList
      stickyTabList
      stickyTabListLevel={0}
      tabs={tabs}
    />
  );
}
