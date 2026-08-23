"use client";

import { useMemo } from "react";
import { TabPanel } from "@/components/common/TabPanel";
import { ChungTuExportWorkspace } from "./ChungTuExportWorkspace.jsx";
import { ChungTuHistoryWorkspace } from "./ChungTuHistoryWorkspace.jsx";
import { ChungTuSignatureSettingsWorkspace } from "./ChungTuSignatureSettingsWorkspace.jsx";
import { getChungTuCategoryConfig } from "./chungTuCategoryConfig";

/**
 * Một loại chứng từ: tab con Xuất chứng từ + Lịch sử.
 * @param {{ categoryKey: string }} props
 */
export function ChungTuCategoryWorkspace({ categoryKey }) {
  const config = getChungTuCategoryConfig(categoryKey);

  const tabs = useMemo(
    () => [
      {
        id: "export",
        label: "Xuất chứng từ",
        panel: (
          <ChungTuExportWorkspace
            categoryKey={categoryKey}
            exportKind={config?.exportKind}
          />
        ),
      },
      {
        id: "history",
        label: "Lịch sử",
        panel: <ChungTuHistoryWorkspace categoryKey={categoryKey} exportKind={config?.exportKind} />,
      },
      {
        id: "signature-settings",
        label: "Cài đặt chữ ký",
        panel: <ChungTuSignatureSettingsWorkspace categoryKey={categoryKey} />,
      },
    ],
    [categoryKey, config?.exportKind],
  );

  return (
    <TabPanel
      persistId={`chungtu-${categoryKey}-subtabs`}
      defaultTabId="export"
      equalWidthTabs
      scrollableTabList
      scrollablePanel={false}
      stickyTabList
      stickyTabListLevel={1}
      fullBleedInCard
      tabs={tabs}
    />
  );
}
