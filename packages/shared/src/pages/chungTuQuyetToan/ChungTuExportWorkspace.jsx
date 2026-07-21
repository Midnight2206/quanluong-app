"use client";

import { Copy, ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { notifyError, notifySuccess } from "@/services/notify";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useHasPermission } from "@/features/auth/model/authSlice";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import { useGetLttpIssueSlipsQuery } from "@/features/lttp/api/lttpApi";
import { useSeedChungTuTemplatesMutation } from "@/features/chung-tu-quyet-toan/api/chungTuTemplateSeedApi";
import {
  CHUNG_TU_AGGREGATION_MODE_OPTIONS,
  CHUNG_TU_AGGREGATION_MODES,
  useChungTuContextPreviewMutation,
  useCreateChungTuDocumentMutation,
} from "@/features/chung-tu-quyet-toan/api/chungTuDocumentApi";
import { ChungTuTemplateTreePicker } from "@/pages/chungTuQuyetToan/ChungTuTemplateTreePicker";
import { ChungTuTemplateMappingPanel } from "@/pages/chungTuQuyetToan/ChungTuTemplateMappingPanel";
import { ChungTuDriveLinkNotice } from "@/pages/chungTuQuyetToan/ChungTuDriveLinkNotice";
import { CHUNG_TU_EXPORT_KIND } from "@/pages/chungTuQuyetToan/chungTuCategoryConfig";
import {
  formatPeriodMonth,
  sameNumberArray,
  todayYmd,
} from "@/pages/chungTuQuyetToan/chungTuFormat";
import { useChungTuUnitScope } from "@/pages/chungTuQuyetToan/useChungTuUnitScope";
import {
  ChungTuExportWizardCard,
  ChungTuExportWizardFooter,
  ChungTuExportWizardStepper,
} from "./ChungTuExportWizard";

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

/**
 * @param {{
 *   categoryKey: string,
 *   exportKind?: "monthly"|"by-slip"|"by-date",
 *   subtitle?: string,
 * }} props
 */
export function ChungTuExportWorkspace({ categoryKey, exportKind }) {
  const canWrite = useHasPermission(PERMISSIONS.LTTP_ISSUE_SLIPS_WRITE);
  const isLgUp = useMediaQuery("(min-width: 1024px)");
  const useWizardLayout = !isLgUp;
  const [wizardStep, setWizardStep] = useState(0);

  const { canPickUnits, unitsForDropdown, effectiveUnitId, persistManualUnitId } =
    useChungTuUnitScope();

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

  const storageUnitLabel = useMemo(
    () =>
      unitsForDropdown.find((u) => Number(u.id) === Number(effectiveUnitId))?.name ??
      (effectiveUnitId != null ? `Đơn vị #${effectiveUnitId}` : "—"),
    [unitsForDropdown, effectiveUnitId],
  );

  const aggregationLabel = useMemo(
    () =>
      CHUNG_TU_AGGREGATION_MODE_OPTIONS.find((o) => o.value === aggregationMode)?.label ??
      aggregationMode,
    [aggregationMode],
  );

  useEffect(() => {
    if (!isMonthly) return;
    if (!allowedUnitIds.length) {
      if (effectiveUnitId != null) {
        const fallbackIds = [Number(effectiveUnitId)];
        setSelectedDataUnitIds((prev) =>
          sameNumberArray(prev, fallbackIds) ? prev : fallbackIds,
        );
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
    setWizardStep(0);
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
  const [seedTemplates, { isLoading: seeding }] = useSeedChungTuTemplatesMutation();

  const handleSeedTemplates = async () => {
    try {
      const result = await seedTemplates();
      const totals = result?.totals ?? { available: 0, copied: 0, skipped: 0 };
      if (totals.available === 0) {
        notifySuccess("Drive hệ thống chưa có mẫu nào để sao chép.");
      } else {
        notifySuccess(`Đã sao chép ${totals.copied} mẫu, bỏ qua ${totals.skipped} mẫu đã có.`);
      }
    } catch (e) {
      notifyError(e?.data?.message || e?.message || "Không sao chép được mẫu từ hệ thống.");
    }
  };

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
        sheetCount:
          isMonthly && aggregationMode === CHUNG_TU_AGGREGATION_MODES.FULL ? 1 : sheetCount,
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
    (isMonthly
      ? selectedDataUnitIds.length > 0
      : isBySlip
        ? Boolean(issueSlipId)
        : Boolean(periodDate));

  const validateWizardStep0 = useCallback(() => {
    if (!effectiveUnitId) {
      setActionError("Chọn đơn vị kho LTTP.");
      return false;
    }
    if (isMonthly && selectedDataUnitIds.length === 0) {
      setActionError("Chọn ít nhất một đơn vị đưa dữ liệu.");
      return false;
    }
    if (isBySlip && !issueSlipId) {
      setActionError("Chọn phiếu xuất LTTP.");
      return false;
    }
    if (!isMonthly && !isBySlip && !periodDate) {
      setActionError("Chọn ngày chứng từ.");
      return false;
    }
    if (!selectedTemplate?.driveFileId) {
      setActionError("Chọn mẫu chứng từ từ Drive.");
      return false;
    }
    setActionError(null);
    return true;
  }, [
    effectiveUnitId,
    isMonthly,
    isBySlip,
    selectedDataUnitIds.length,
    issueSlipId,
    periodDate,
    selectedTemplate?.driveFileId,
  ]);

  const goWizardNext = useCallback(() => {
    if (!validateWizardStep0()) {
      return;
    }
    setWizardStep(1);
  }, [validateWizardStep0]);

  const goWizardBack = useCallback(() => {
    setWizardStep((s) => Math.max(0, s - 1));
  }, []);

  const wizardShowParams = useWizardLayout && wizardStep === 0;
  const wizardShowMap = useWizardLayout && wizardStep === 1;
  const showDesktopLayout = !useWizardLayout;
  const unitsListMaxH = useWizardLayout ? "max-h-[min(20rem,42vh)]" : "max-h-48";
  const templateListMaxH = useWizardLayout ? "max-h-[min(22rem,48vh)]" : "max-h-64";
  const expandedCards = useWizardLayout;

  const paramsFields = (
    <div className="grid gap-3 sm:grid-cols-2">
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
      ) : null}

      {isMonthly ? (
        <label className="space-y-1" htmlFor={`ct-export-month-${categoryKey}`}>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
            Tháng chứng từ
          </span>
          <input
            id={`ct-export-month-${categoryKey}`}
            type="month"
            className={fieldClass}
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
            className={fieldClass}
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
            className={fieldClass}
            value={issueSlipId}
            disabled={slipsLoading || !effectiveUnitId}
            onChange={(e) => setIssueSlipId(e.target.value)}
          >
            <option value="">
              {slipsLoading
                ? "Đang tải phiếu…"
                : slips.length
                  ? "— Chọn phiếu —"
                  : "Không có phiếu trong ngày"}
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
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CHUNG_TU_AGGREGATION_MODE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  "flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3 text-sm transition",
                  aggregationMode === opt.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
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
                <span className="text-[10px] leading-snug text-muted-foreground">{opt.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {isMonthly && unitsForDropdown.length > 0 ? (
        <div className="space-y-2 sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
              Đơn vị đưa dữ liệu ({selectedDataUnitIds.length}/{unitsForDropdown.length})
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="min-h-9 rounded px-2 text-xs font-medium text-primary hover:underline"
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
                className="min-h-9 rounded px-2 text-xs text-muted-foreground hover:text-foreground hover:underline"
                onClick={() => setSelectedDataUnitIds([])}
              >
                Bỏ chọn
              </button>
            </div>
          </div>
          <div
            data-local-scroll="true"
            className={cn(
              "grid gap-1 overflow-auto rounded-xl border border-border bg-background/80 p-2 sm:grid-cols-2",
              unitsListMaxH,
            )}
          >
            {unitsForDropdown.map((u) => {
              const id = Number(u.id);
              const checked = selectedDataUnitIds.includes(id);
              return (
                <label
                  key={u.id}
                  className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted/80"
                >
                  <input
                    type="checkbox"
                    className="size-4 shrink-0"
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
  );

  const templatePickerBlock = (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {canWrite ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 w-full gap-1.5 text-xs sm:ml-auto sm:w-auto"
            disabled={seeding}
            onClick={handleSeedTemplates}
            title="Sao chép mẫu có sẵn từ Drive hệ thống vào Drive của bạn"
          >
            {seeding ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Copy className="mr-1.5 h-3.5 w-3.5" />
            )}
            Sao chép mẫu từ hệ thống
          </Button>
        ) : null}
      </div>
      <ChungTuTemplateTreePicker
        categoryKey={categoryKey}
        selectedDriveFileId={selectedTemplate?.driveFileId ?? ""}
        onSelect={setSelectedTemplate}
        listMaxHeightClass={templateListMaxH}
      />
      {selectedTemplate ? (
        <p className="rounded-lg bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          Đã chọn:{" "}
          <span className="font-medium text-foreground">{selectedTemplate.fullDocumentName}</span>
        </p>
      ) : null}
    </>
  );

  const mappingBlock =
    selectedTemplate?.driveFileId ? (
      <ChungTuTemplateMappingPanel
        categoryKey={categoryKey}
        driveFileId={selectedTemplate.driveFileId}
        canWrite={canWrite}
      />
    ) : (
      <p className="text-xs text-muted-foreground">Chọn mẫu ở bước trước để map cột dữ liệu.</p>
    );

  const actionButtons = (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10 w-full gap-1.5 text-xs sm:w-auto"
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
          className="h-10 w-full gap-1.5 text-xs sm:w-auto"
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
          className="inline-flex min-h-10 w-full items-center justify-center gap-1 text-xs text-primary hover:underline sm:w-auto"
        >
          Mở sheet vừa tạo
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </>
  );

  const wizardSummary = (
    <dl className="grid gap-2 text-xs sm:grid-cols-2">
      <div className="rounded-lg bg-muted/25 px-3 py-2">
        <dt className="text-[10px] uppercase text-muted-foreground">Kho LTTP</dt>
        <dd className="mt-0.5 font-medium">{storageUnitLabel}</dd>
      </div>
      <div className="rounded-lg bg-muted/25 px-3 py-2">
        <dt className="text-[10px] uppercase text-muted-foreground">
          {isMonthly ? "Tháng" : "Ngày"}
        </dt>
        <dd className="mt-0.5 font-medium">
          {isMonthly ? formatPeriodMonth(periodMonth) : periodDate}
        </dd>
      </div>
      {isMonthly ? (
        <div className="rounded-lg bg-muted/25 px-3 py-2 sm:col-span-2">
          <dt className="text-[10px] uppercase text-muted-foreground">Gộp dữ liệu</dt>
          <dd className="mt-0.5 font-medium">
            {aggregationLabel} · {selectedDataUnitIds.length} đơn vị
          </dd>
        </div>
      ) : null}
      <div className="rounded-lg bg-muted/25 px-3 py-2 sm:col-span-2">
        <dt className="text-[10px] uppercase text-muted-foreground">Mẫu</dt>
        <dd className="mt-0.5 font-medium leading-snug">
          {selectedTemplate?.fullDocumentName ?? "—"}
        </dd>
      </div>
    </dl>
  );

  return (
    <div
      className={cn(
        useWizardLayout ? "space-y-3 px-0 py-3 sm:p-4" : "space-y-3 p-3 sm:p-4",
        useWizardLayout && wizardStep === 1 && "pb-36",
        useWizardLayout && wizardStep === 0 && "pb-20",
      )}
    >
      <ChungTuDriveLinkNotice
        className={
          expandedCards
            ? "-mx-4 rounded-none border-x-0 sm:mx-0 sm:rounded-lg sm:border-x"
            : undefined
        }
      />

      {useWizardLayout ? (
        <ChungTuExportWizardStepper stepIndex={wizardStep} className="-mx-1" />
      ) : null}

      {showDesktopLayout ? (
        <>
          <ChungTuExportWizardCard
            title="Tham số chứng từ"
            description="Chọn kho, kỳ dữ liệu và đơn vị nguồn LTTP."
          >
            {paramsFields}
          </ChungTuExportWizardCard>

          <ChungTuExportWizardCard
            title="Mẫu chứng từ (Drive)"
            description="Chọn mẫu, map cột và tạo Google Sheet."
          >
            {templatePickerBlock}
            <p className="text-[10px] text-muted-foreground">
              Map cột bảng chi tiết trước khi tạo/đồng bộ.
            </p>
            {mappingBlock}
          </ChungTuExportWizardCard>
        </>
      ) : null}

      {wizardShowParams ? (
        <>
          <ChungTuExportWizardCard
            title="Tham số chứng từ"
            description="Chọn kho, kỳ dữ liệu và đơn vị nguồn LTTP."
            expanded={expandedCards}
          >
            {paramsFields}
          </ChungTuExportWizardCard>

          <ChungTuExportWizardCard
            title="Mẫu chứng từ (Drive)"
            description="Chọn file mẫu Google Sheets để điền dữ liệu."
            expanded={expandedCards}
          >
            {templatePickerBlock}
          </ChungTuExportWizardCard>
        </>
      ) : null}

      {wizardShowMap ? (
        <>
          <ChungTuExportWizardCard title="Tóm tắt" expanded={expandedCards} bodyClassName="py-3">
            {wizardSummary}
          </ChungTuExportWizardCard>

          <ChungTuExportWizardCard
            title="Map dữ liệu → ô mẫu"
            description="Gán cột bảng chi tiết trước khi tạo Sheet."
            expanded={expandedCards}
            bodyClassName="space-y-4"
          >
            {mappingBlock}
          </ChungTuExportWizardCard>
        </>
      ) : null}

      {actionError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {actionError}
        </p>
      ) : null}

      {previewInfo ? (
        <p className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Xem trước: {previewInfo.lineCount} dòng
          {previewInfo.sheetCount > 0 ? ` · ${previewInfo.sheetCount} sheet` : ""} · Tổng{" "}
          {previewInfo.tongTien || "0"} đ
        </p>
      ) : null}

      {!useWizardLayout ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">{actionButtons}</div>
      ) : null}

      {useWizardLayout && wizardStep === 0 ? (
        <ChungTuExportWizardFooter
          stepIndex={wizardStep}
          onBack={goWizardBack}
          onNext={goWizardNext}
          nextDisabled={!effectiveUnitId}
        />
      ) : null}

      {useWizardLayout && wizardStep === 1 ? (
        <ChungTuExportWizardFooter stepIndex={wizardStep} onBack={goWizardBack}>
          {actionButtons}
        </ChungTuExportWizardFooter>
      ) : null}
    </div>
  );
}
