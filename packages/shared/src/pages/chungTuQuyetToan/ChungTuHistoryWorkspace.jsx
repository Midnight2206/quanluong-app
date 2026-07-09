"use client";

import { ExternalLink, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ResponsiveTableWrap } from "@/components/common/ScrollableHorizontalStrip";
import { cn } from "@/utils/cn";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useHasPermission } from "@/features/auth/model/authSlice";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import {
  useChungTuDocumentsQuery,
  useDeleteChungTuDocumentMutation,
  useOpenChungTuDocumentMutation,
  useSyncChungTuDocumentMutation,
} from "@/features/chung-tu-quyet-toan/api/chungTuDocumentApi";
import { CHUNG_TU_EXPORT_KIND } from "@/pages/chungTuQuyetToan/chungTuCategoryConfig";
import { chungTuStatusBadge, formatPeriodLabel } from "@/pages/chungTuQuyetToan/chungTuFormat";
import { useChungTuUnitScope } from "@/pages/chungTuQuyetToan/useChungTuUnitScope";
import { ChungTuHistoryDocumentCard } from "./ChungTuHistoryDocumentCard";
import { ChungTuExportWizardCard } from "./ChungTuExportWizard";

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

function StatusBadge({ status }) {
  const badge = chungTuStatusBadge(status);
  return <span className={badge.className}>{badge.label}</span>;
}

/**
 * @param {{
 *   categoryKey: string,
 *   exportKind?: "monthly"|"by-slip"|"by-date",
 * }} props
 */
export function ChungTuHistoryWorkspace({ categoryKey, exportKind }) {
  const canWrite = useHasPermission(PERMISSIONS.LTTP_ISSUE_SLIPS_WRITE);
  const isLgUp = useMediaQuery("(min-width: 1024px)");
  const { canPickUnits, unitsForDropdown, effectiveUnitId, persistManualUnitId } = useChungTuUnitScope();
  const [actionError, setActionError] = useState(null);

  const { data: documents = [], isLoading: docsLoading } = useChungTuDocumentsQuery(
    { unitId: effectiveUnitId, categoryKey },
    { skip: !effectiveUnitId },
  );

  const [syncDoc, { isLoading: syncing }] = useSyncChungTuDocumentMutation();
  const [openDoc, { isLoading: openingDoc }] = useOpenChungTuDocumentMutation();
  const [deleteDoc, { isLoading: deletingDoc }] = useDeleteChungTuDocumentMutation();

  const handleSync = async (doc) => {
    setActionError(null);
    try {
      const data = await syncDoc({
        documentKey: doc.documentKey,
        unitId: effectiveUnitId,
        categoryKey,
      });
      const link = data?.outputWebViewLink;
      if (link) window.open(link, "_blank", "noopener,noreferrer");
    } catch (e) {
      setActionError(e?.data?.message || e?.message || "Không đồng bộ được.");
    }
  };

  const handleOpenDocument = async (doc) => {
    setActionError(null);
    try {
      const data = await openDoc({
        documentKey: doc.documentKey,
        unitId: effectiveUnitId,
        categoryKey,
      });
      const link = data?.outputWebViewLink;
      if (link) window.open(link, "_blank", "noopener,noreferrer");
    } catch (e) {
      setActionError(e?.data?.message || e?.message || "Không mở được chứng từ.");
    }
  };

  const handleDeleteDocument = async (doc) => {
    const ok = window.confirm("Xóa chứng từ này? File Google Sheet sẽ được đưa vào thùng rác nếu còn tồn tại.");
    if (!ok) return;
    setActionError(null);
    try {
      await deleteDoc({
        documentKey: doc.documentKey,
        unitId: effectiveUnitId,
        categoryKey,
      });
    } catch (e) {
      setActionError(e?.data?.message || e?.message || "Không xóa được chứng từ.");
    }
  };

  const showAggregation = exportKind === CHUNG_TU_EXPORT_KIND.MONTHLY;
  const periodHeader =
    exportKind === CHUNG_TU_EXPORT_KIND.MONTHLY ? "Tháng/Năm" : "Ngày / Phiếu";
  const expandedLayout = !isLgUp;

  return (
    <div
      className={cn(
        "space-y-3",
        expandedLayout ? "px-0 py-3 sm:p-4" : "p-3 sm:p-4",
      )}
    >
      {canPickUnits && unitsForDropdown.length > 0 && effectiveUnitId != null ? (
        <ChungTuExportWizardCard
          title="Bộ lọc"
          description="Chọn kho LTTP để xem chứng từ đã lưu."
          expanded={expandedLayout}
        >
          <label className="block min-w-0 space-y-1" htmlFor={`ct-history-unit-${categoryKey}`}>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
              Đơn vị kho LTTP
            </span>
            <select
              id={`ct-history-unit-${categoryKey}`}
              className={fieldClass}
              value={String(effectiveUnitId ?? "")}
              onChange={(e) => {
                const v = e.target.value;
                persistManualUnitId(v === "" ? null : Number(v));
              }}
            >
              {unitsForDropdown.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? `Đơn vị #${u.id}`}
                </option>
              ))}
            </select>
          </label>
        </ChungTuExportWizardCard>
      ) : null}

      {actionError ? (
        <p
          className={cn(
            "rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive",
            expandedLayout && "mx-0 rounded-none border-x-0 sm:mx-0 sm:rounded-lg sm:border-x",
          )}
        >
          {actionError}
        </p>
      ) : null}

      {docsLoading ? (
        <ChungTuExportWizardCard
          title="Danh sách chứng từ"
          expanded={expandedLayout}
          bodyClassName="py-6"
        >
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Đang tải lịch sử…
          </p>
        </ChungTuExportWizardCard>
      ) : documents.length === 0 ? (
        <ChungTuExportWizardCard
          title="Danh sách chứng từ"
          expanded={expandedLayout}
          bodyClassName="py-6"
        >
          <p className="text-center text-sm text-muted-foreground">
            Chưa có chứng từ nào cho đơn vị này.
          </p>
        </ChungTuExportWizardCard>
      ) : !isLgUp ? (
        <ChungTuExportWizardCard
          title={`Danh sách (${documents.length})`}
          description="Chạm Mở / Đồng bộ / Xóa trên từng chứng từ."
          expanded={expandedLayout}
          bodyClassName="divide-y divide-border/60 space-y-0 p-0"
        >
          {documents.map((doc) => (
            <ChungTuHistoryDocumentCard
              key={doc.documentKey}
              doc={doc}
              exportKind={exportKind}
              canWrite={canWrite}
              syncing={syncing}
              openingDoc={openingDoc}
              deletingDoc={deletingDoc}
              inset
              onOpen={() => handleOpenDocument(doc)}
              onSync={() => handleSync(doc)}
              onDelete={() => handleDeleteDocument(doc)}
            />
          ))}
        </ChungTuExportWizardCard>
      ) : (
        <ResponsiveTableWrap className="border-border/80">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Tên chứng từ</th>
                <th className="px-3 py-2 font-semibold">Mã chứng từ</th>
                <th className="px-3 py-2 font-semibold">Đơn vị</th>
                <th className="px-3 py-2 font-semibold">{periodHeader}</th>
                {showAggregation ? (
                  <th className="px-3 py-2 font-semibold">Gộp</th>
                ) : null}
                <th className="px-3 py-2 font-semibold">TT</th>
                <th className="px-3 py-2 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {documents.map((doc) => {
                const unitLabel =
                  doc.selectedUnitNames?.length > 1
                    ? `${doc.unitName ?? ""} (${doc.selectedUnitNames.length} ĐV dữ liệu)`
                    : doc.selectedUnitNames?.[0] ?? doc.unitName ?? "—";
                return (
                  <tr key={doc.documentKey} className="align-top">
                    <td className="px-3 py-2 font-medium">
                      {doc.documentName || doc.templateName || "—"}
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-2 font-mono text-[11px] text-muted-foreground">
                      {doc.documentCode || doc.templateName || "—"}
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-2 text-xs">{unitLabel}</td>
                    <td className="px-3 py-2 text-xs">{formatPeriodLabel(doc, exportKind)}</td>
                    {showAggregation ? (
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {doc.aggregationModeLabel || "—"}
                      </td>
                    ) : null}
                    <td className="px-3 py-2"><StatusBadge status={doc.status} /></td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-1">
                        {doc.outputWebViewLink ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={openingDoc}
                            onClick={() => handleOpenDocument(doc)}
                          >
                            Mở
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        ) : null}
                        {canWrite && doc.status !== "locked" ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={syncing}
                              onClick={() => handleSync(doc)}
                            >
                              <RefreshCw className={cn("mr-1 h-3 w-3", syncing ? "animate-spin" : "")} />
                              Đồng bộ
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={deletingDoc}
                              onClick={() => handleDeleteDocument(doc)}
                            >
                              <Trash2 className="mr-1 h-3 w-3" />
                              Xóa
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ResponsiveTableWrap>
      )}
    </div>
  );
}
