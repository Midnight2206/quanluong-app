"use client";

import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { StickyResponsiveTable } from "@/components/common/StickyHorizontalTable";
import { Button } from "@/components/ui/Button";
import { CHUNG_TU_AGGREGATION_MODE_OPTIONS } from "@/features/chung-tu-quyet-toan/api/chungTuDocumentApi";
import { useChungTuBkmhMonthlyListQuery } from "@/features/chung-tu-quyet-toan/api/chungTuBkmhMonthlyApi";
import { formatVnd } from "@/utils/formatVnd";
import { cn } from "@/utils/cn";
import { formatPeriodMonth } from "@/pages/chungTuQuyetToan/chungTuFormat";
import { useChungTuUnitScope } from "@/pages/chungTuQuyetToan/useChungTuUnitScope";
import { ChungTuExportWizardCard } from "./ChungTuExportWizard";
import { ChungTuBkmhSliceSummaryPanel } from "./ChungTuBkmhSliceSummaryPanel.jsx";

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

const exportTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatExportedAt(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return exportTimeFormatter.format(date);
}

/**
 * @param {{ categoryKey: string }} props
 */
export function ChungTuSummaryWorkspace({ categoryKey }) {
  const { canPickUnits, unitsForDropdown, effectiveUnitId, persistManualUnitId } =
    useChungTuUnitScope();
  const [selectedMonthly, setSelectedMonthly] = useState(null);

  const { data: monthlyRows = [], isLoading } = useChungTuBkmhMonthlyListQuery(
    { storageUnitId: effectiveUnitId },
    { skip: !effectiveUnitId },
  );

  const aggregationLabelByValue = useMemo(
    () => new Map(CHUNG_TU_AGGREGATION_MODE_OPTIONS.map((item) => [item.value, item.label])),
    [],
  );

  const expandedLayout = true;

  return (
    <>
      <div
        className={cn(
          "space-y-3",
          expandedLayout ? "px-0 py-3 sm:p-4" : "p-3 sm:p-4",
        )}
      >
        {canPickUnits && unitsForDropdown.length > 0 && effectiveUnitId != null ? (
          <ChungTuExportWizardCard
            title="Bộ lọc"
            description="Chọn kho LTTP để xem các tháng BKMH đã xuất."
            expanded={expandedLayout}
          >
            <label className="block min-w-0 space-y-1" htmlFor={`ct-summary-unit-${categoryKey}`}>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                Đơn vị kho LTTP
              </span>
              <select
                id={`ct-summary-unit-${categoryKey}`}
                className={fieldClass}
                value={String(effectiveUnitId ?? "")}
                onChange={(e) => {
                  const value = e.target.value;
                  persistManualUnitId(value === "" ? null : Number(value));
                }}
              >
                {unitsForDropdown.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name ?? `Đơn vị #${unit.id}`}
                  </option>
                ))}
              </select>
            </label>
          </ChungTuExportWizardCard>
        ) : null}

        {isLoading ? (
          <ChungTuExportWizardCard
            title="Tổng hợp BKMH"
            expanded={expandedLayout}
            bodyClassName="py-6"
          >
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Đang tải bảng tổng hợp…
            </p>
          </ChungTuExportWizardCard>
        ) : monthlyRows.length === 0 ? (
          <ChungTuExportWizardCard
            title="Tổng hợp BKMH"
            expanded={expandedLayout}
            bodyClassName="py-6"
          >
            <p className="text-center text-sm text-muted-foreground">
              Chưa có tháng BKMH nào cho đơn vị này.
            </p>
          </ChungTuExportWizardCard>
        ) : (
          <ChungTuExportWizardCard
            title={`Tổng hợp BKMH (${monthlyRows.length})`}
            description="Mỗi dòng là một tháng đã xuất cho kho LTTP đang chọn."
            expanded={expandedLayout}
            bodyClassName="space-y-3"
          >
            <StickyResponsiveTable stickyLevel={2} className="border-border/80">
              <table className="w-full min-w-[54rem] text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[10px] uppercase text-muted-foreground">
                    <th className="px-3 py-2 font-semibold">Tháng</th>
                    <th className="px-3 py-2 font-semibold">Chế độ gộp</th>
                    <th className="px-3 py-2 font-semibold">Số slice</th>
                    <th className="px-3 py-2 font-semibold">Tổng tiền tháng</th>
                    <th className="px-3 py-2 font-semibold">Cập nhật lúc</th>
                    <th className="px-3 py-2 font-semibold text-right">Mở tổng hợp</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.map((item) => (
                    <tr key={item.id} className="border-b border-border/50">
                      <td className="px-3 py-2.5 font-medium text-foreground">
                        {formatPeriodMonth(item.periodMonth)}
                      </td>
                      <td className="px-3 py-2.5 text-foreground">
                        {aggregationLabelByValue.get(item.aggregationMode) || item.aggregationMode || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-foreground">{item.sliceCount ?? 0}</td>
                      <td className="px-3 py-2.5 text-foreground">{formatVnd(item.tongTienThang)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {formatExportedAt(item.updatedAt)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 gap-1.5 text-xs"
                          onClick={() =>
                            setSelectedMonthly({
                              id: item.id,
                              aggregationMode: item.aggregationMode,
                            })
                          }
                        >
                          Mở tổng hợp
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </StickyResponsiveTable>
          </ChungTuExportWizardCard>
        )}
      </div>

      <ChungTuBkmhSliceSummaryPanel
        monthlyId={selectedMonthly?.id ?? ""}
        aggregationMode={selectedMonthly?.aggregationMode ?? ""}
        open={Boolean(selectedMonthly)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMonthly(null);
          }
        }}
      />
    </>
  );
}
