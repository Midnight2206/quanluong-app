"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { useHasPermission } from "@/features/auth/model/authSlice";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import { useGetLttpIssueSlipsQuery } from "@/features/lttp/api/lttpApi";
import {
  CHUNG_TU_AGGREGATION_MODE_OPTIONS,
  CHUNG_TU_AGGREGATION_MODES,
  useChungTuContextPreviewMutation,
  useCreateChungTuDocumentMutation,
} from "@/features/chung-tu-quyet-toan/api/chungTuDocumentApi";
import { ChungTuTemplateTreePicker } from "@/pages/chungTuQuyetToan/ChungTuTemplateTreePicker";
import { ChungTuTemplateMappingPanel } from "@/pages/chungTuQuyetToan/ChungTuTemplateMappingPanel";
import { CHUNG_TU_EXPORT_KIND } from "@/pages/chungTuQuyetToan/chungTuCategoryConfig";
import { sameNumberArray, todayYmd } from "@/pages/chungTuQuyetToan/chungTuFormat";
import { useChungTuUnitScope } from "@/pages/chungTuQuyetToan/useChungTuUnitScope";

/**
 * @param {{
 *   categoryKey: string,
 *   exportKind?: "monthly"|"by-slip"|"by-date",
 *   subtitle?: string,
 * }} props
 */
export function ChungTuExportWorkspace({ categoryKey, exportKind, subtitle }) {
  const canWrite = useHasPermission(PERMISSIONS.LTTP_ISSUE_SLIPS_WRITE);
  const { canPickUnits, unitsForDropdown, effectiveUnitId, persistManualUnitId } = useChungTuUnitScope();

  const isMonthly = exportKind === CHUNG_TU_EXPORT_KIND.MONTHLY;
  const isBySlip = exportKind === CHUNG_TU_EXPORT_KIND.BY_SLIP;

  const [periodMonth, setPeriodMonth] = useState(() => todayYmd().slice(0, 7));
  const [periodDate, setPeriodDate] = useState(todayYmd);
  const [issueSlipId, setIssueSlipId] = useState("");
  const [selectedDataUnitIds, setSelectedDataUnitIds] = useState([]);
  const [aggregationMode, setAggregationMode] = useState(CHUNG_TU_AGGREGATION_MODES.BY_DAY);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [previewInfo, setPreviewInfo] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [lastOpenedLink, setLastOpenedLink] = useState(null);

  const allowedUnitIds = useMemo(
    () => unitsForDropdown.map((u) => Number(u.id)).filter(Number.isFinite),
    [unitsForDropdown],
  );

  useEffect(() => {
    if (!isMonthly) return;
    if (!allowedUnitIds.length) {
      if (effectiveUnitId != null) {
        const fallbackIds = [Number(effectiveUnitId)];
        setSelectedDataUnitIds((prev) => (sameNumberArray(prev, fallbackIds) ? prev : fallbackIds));
      }
      return;
    }
    setSelectedDataUnitIds((prev) => {
      const allowed = new Set(allowedUnitIds);
      const kept = prev.filter((id) => allowed.has(Number(id)));
      const next = kept.length ? kept : allowedUnitIds;
      return sameNumberArray(prev, next) ? prev : next;
    });
  }, [allowedUnitIds, effectiveUnitId, isMonthly]);

  useEffect(() => {
    setSelectedTemplate(null);
    setPreviewInfo(null);
    setActionError(null);
    setLastOpenedLink(null);
    setIssueSlipId("");
  }, [categoryKey]);

  const { data: slipsPayload, isLoading: slipsLoading } = useGetLttpIssueSlipsQuery(
    {
      unitId: effectiveUnitId,
      from: periodDate,
      to: periodDate,
      page: 1,
      pageSize: 50,
    },
    { skip: !isBySlip || !effectiveUnitId || !periodDate },
  );
  const slips = slipsPayload?.items ?? [];

  const [createDoc, { isLoading: creating }] = useCreateChungTuDocumentMutation();
  const [previewCtx, { isLoading: previewing }] = useChungTuContextPreviewMutation();

  const buildPayloadBase = useCallback(() => {
    const base = {
      categoryKey,
      unitId: effectiveUnitId,
      templateDisplayName: selectedTemplate?.fullDocumentName ?? selectedTemplate?.displayName,
    };
    if (isMonthly) {
      return {
        ...base,
        periodMonth,
        unitIds: selectedDataUnitIds,
        aggregationMode,
      };
    }
    if (isBySlip) {
      return {
        ...base,
        periodDate,
        issueSlipId: issueSlipId ? Number(issueSlipId) : undefined,
      };
    }
    return {
      ...base,
      periodDate,
    };
  }, [
    categoryKey,
    effectiveUnitId,
    selectedTemplate,
    isMonthly,
    isBySlip,
    periodMonth,
    selectedDataUnitIds,
    aggregationMode,
    periodDate,
    issueSlipId,
  ]);

  const handlePreview = async () => {
    if (!selectedTemplate) {
      setActionError("Chọn mẫu chứng từ.");
      return;
    }
    if (isBySlip && !issueSlipId) {
      setActionError("Chọn phiếu xuất LTTP.");
      return;
    }
    setActionError(null);
    setPreviewInfo(null);
    try {
      const data = await previewCtx(buildPayloadBase());
      const sheetCount = data?.context?.sheetContexts?.length ?? 0;
      setPreviewInfo({
        lineCount: data?.context?.detailRows?.length ?? 0,
        sheetCount: isMonthly && aggregationMode === CHUNG_TU_AGGREGATION_MODES.FULL ? 1 : sheetCount,
        tongTien: data?.context?.tongTien ?? "",
      });
    } catch (e) {
      setActionError(e?.data?.message || e?.message || "Không xem trước được dữ liệu.");
    }
  };

  const handleCreate = async () => {
    if (!selectedTemplate) {
      setActionError("Chọn mẫu chứng từ.");
      return;
    }
    if (isMonthly && selectedDataUnitIds.length === 0) {
      setActionError("Chọn ít nhất một đơn vị để đưa dữ liệu vào chứng từ.");
      return;
    }
    if (isBySlip && !issueSlipId) {
      setActionError("Chọn phiếu xuất LTTP.");
      return;
    }
    setActionError(null);
    try {
      const result = await createDoc({
        ...buildPayloadBase(),
        templateDriveFileId: selectedTemplate.driveFileId,
      });
      const link = result?.document?.outputWebViewLink;
      if (link) {
        setLastOpenedLink(link);
        window.open(link, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      setActionError(e?.data?.message || e?.message || "Không tạo được chứng từ.");
    }
  };

  const busy = creating || previewing;
  const canRun =
    Boolean(selectedTemplate) &&
    (isMonthly ? selectedDataUnitIds.length > 0 : isBySlip ? Boolean(issueSlipId) : Boolean(periodDate));

  return (
    <div className="space-y-4 p-3 sm:p-4">
      {subtitle ? (
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      ) : null}

      <div className="grid gap-3 rounded-xl border border-border/80 bg-card/40 p-3 sm:grid-cols-2">
        {canPickUnits && unitsForDropdown.length > 0 && effectiveUnitId != null ? (
          <label
            className={cn("min-w-0 space-y-1", isMonthly ? "sm:col-span-2" : "")}
            htmlFor={`ct-export-unit-${categoryKey}`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
              Đơn vị kho LTTP
            </span>
            <select
              id={`ct-export-unit-${categoryKey}`}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
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
        ) : null}

        {isMonthly ? (
          <label className="space-y-1" htmlFor={`ct-export-month-${categoryKey}`}>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
              Tháng chứng từ
            </span>
            <input
              id={`ct-export-month-${categoryKey}`}
              type="month"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              value={periodMonth}
              onChange={(e) => setPeriodMonth(e.target.value)}
            />
          </label>
        ) : (
          <label className="space-y-1" htmlFor={`ct-export-date-${categoryKey}`}>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
              Ngày chứng từ
            </span>
            <input
              id={`ct-export-date-${categoryKey}`}
              type="date"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              value={periodDate}
              onChange={(e) => {
                setPeriodDate(e.target.value);
                setIssueSlipId("");
              }}
            />
          </label>
        )}

        {isBySlip ? (
          <label className="space-y-1 sm:col-span-2" htmlFor={`ct-export-slip-${categoryKey}`}>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
              Phiếu xuất LTTP
            </span>
            <select
              id={`ct-export-slip-${categoryKey}`}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              value={issueSlipId}
              disabled={slipsLoading || !effectiveUnitId}
              onChange={(e) => setIssueSlipId(e.target.value)}
            >
              <option value="">
                {slipsLoading ? "Đang tải phiếu…" : slips.length ? "— Chọn phiếu —" : "Không có phiếu trong ngày"}
              </option>
              {slips.map((slip) => (
                <option key={slip.id} value={slip.id}>
                  #{slip.id} — {slip.issueDate?.slice(0, 10) ?? ""} ({slip.lines?.length ?? 0} dòng)
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {isMonthly ? (
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
              Chế độ gộp dữ liệu
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {CHUNG_TU_AGGREGATION_MODE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    "flex cursor-pointer flex-col gap-1 rounded-lg border p-2.5 text-sm transition",
                    aggregationMode === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <input
                      type="radio"
                      name={`ct-aggregation-mode-${categoryKey}`}
                      checked={aggregationMode === opt.value}
                      onChange={() => setAggregationMode(opt.value)}
                    />
                    {opt.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{opt.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {isMonthly && unitsForDropdown.length > 0 ? (
          <div className="space-y-2 sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                Đơn vị đưa dữ liệu
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-[11px] text-primary hover:underline"
                  onClick={() =>
                    setSelectedDataUnitIds(
                      unitsForDropdown.map((u) => Number(u.id)).filter(Number.isFinite),
                    )
                  }
                >
                  Chọn tất cả
                </button>
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                  onClick={() => setSelectedDataUnitIds([])}
                >
                  Bỏ chọn
                </button>
              </div>
            </div>
            <div className="grid max-h-48 gap-1 overflow-auto rounded-lg border border-border bg-background/60 p-2 sm:grid-cols-2">
              {unitsForDropdown.map((u) => {
                const id = Number(u.id);
                const checked = selectedDataUnitIds.includes(id);
                return (
                  <label
                    key={u.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedDataUnitIds((prev) => {
                          if (e.target.checked) {
                            return prev.includes(id) ? prev : [...prev, id].sort((a, b) => a - b);
                          }
                          return prev.filter((x) => x !== id);
                        });
                      }}
                    />
                    <span className="min-w-0 truncate">{u.name ?? `Đơn vị #${u.id}`}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-2 rounded-xl border border-border/80 bg-card/40 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
          Mẫu chứng từ (thư mục Drive hệ thống)
        </h3>
        <ChungTuTemplateTreePicker
          categoryKey={categoryKey}
          selectedDriveFileId={selectedTemplate?.driveFileId ?? ""}
          onSelect={setSelectedTemplate}
        />
        {selectedTemplate ? (
          <p className="text-[11px] text-muted-foreground">
            Đã chọn:{" "}
            <span className="font-medium text-foreground">{selectedTemplate.fullDocumentName}</span>
          </p>
        ) : null}
        <p className="text-[10px] text-muted-foreground">
          Map cột bảng chi tiết bên dưới trước khi tạo/đồng bộ.
        </p>
        {selectedTemplate?.driveFileId ? (
          <ChungTuTemplateMappingPanel
            categoryKey={categoryKey}
            driveFileId={selectedTemplate.driveFileId}
            canWrite={canWrite}
          />
        ) : null}
      </div>

      {actionError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {actionError}
        </p>
      ) : null}

      {previewInfo ? (
        <p className="text-xs text-muted-foreground">
          Xem trước: {previewInfo.lineCount} dòng
          {previewInfo.sheetCount > 0 ? ` · ${previewInfo.sheetCount} sheet` : ""} · Tổng{" "}
          {previewInfo.tongTien || "0"} đ
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!effectiveUnitId || !canRun || busy}
          onClick={handlePreview}
        >
          {previewing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Xem trước dữ liệu LTTP
        </Button>
        {canWrite ? (
          <Button
            type="button"
            size="sm"
            disabled={!effectiveUnitId || !canRun || busy}
            onClick={handleCreate}
          >
            {creating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Tạo / mở Google Sheet
          </Button>
        ) : null}
        {lastOpenedLink ? (
          <a
            href={lastOpenedLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Mở sheet vừa tạo
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
