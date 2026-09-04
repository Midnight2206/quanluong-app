"use client";

import { BookOpen, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { notifyError, notifySuccess } from "@/services/notify";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useHasPermission } from "@/features/auth/model/authSlice";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import { useGetLttpIssueSlipsQuery } from "@/features/lttp/api/lttpApi";
import {
  CHUNG_TU_AGGREGATION_MODE_OPTIONS,
  CHUNG_TU_AGGREGATION_MODES,
  useChungTuContextPreviewMutation,
} from "@/features/chung-tu-quyet-toan/api/chungTuDocumentApi";
import {
  useChungTuPdfFieldCatalogQuery,
  useChungTuSignatureSettingsQuery,
  useChungTuPdfTemplateFieldsQuery,
  useChungTuPdfTemplatesQuery,
  useCreateChungTuPdfExportBatchMutation,
} from "@/features/chung-tu-quyet-toan/api/chungTuPdfApi";
import { useCreateChungTuBkmhMonthlyExportMutation } from "@/features/chung-tu-quyet-toan/api/chungTuBkmhMonthlyApi";
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

const DEFAULT_SIGNATURE_SLOTS = [
  {
    key: "nguoi_lap",
    label: "Người lập",
    source: "dynamic",
    showDateLine: false,
    staticName: "",
  },
  {
    key: "thu_truong",
    label: "Thủ trưởng đơn vị",
    source: "dynamic",
    showDateLine: false,
    staticName: "",
  },
];

function getTemplateLabel(template) {
  if (!template) return "";
  const base = template.displayName || template.name || `Mẫu #${template.id}`;
  return template.version ? `${base} (v${template.version})` : base;
}

function formatSignatureSlotLabel(label) {
  return String(label ?? "").replace(/\\n/g, "\n").trim();
}

function extractSignatureBlock(payload) {
  const root = payload && typeof payload === "object" ? payload : {};
  const candidates = [
    root.signatureBlock,
    root.signature_block,
    root.fields?.signatureBlock,
    root.fields?.signature_block,
    root.fields?.data?.signatureBlock,
    root.fields?.data?.signature_block,
    root.data?.signatureBlock,
    root.data?.signature_block,
  ];
  return (
    candidates.find((candidate) => candidate && typeof candidate === "object" && Array.isArray(candidate.slots)) ??
    null
  );
}

function normalizeSignatureSource(source) {
  if (source === "static") return "static";
  if (source === "system") return "system";
  return "dynamic";
}

function normalizeSignatureSlots(signatureBlock) {
  if (!Array.isArray(signatureBlock?.slots) || signatureBlock.slots.length === 0) {
    return DEFAULT_SIGNATURE_SLOTS;
  }
  const slots = signatureBlock.slots
    .map((slot) => {
      const key = typeof slot?.key === "string" ? slot.key.trim() : "";
      if (!key) return null;
      return {
        key,
        label: formatSignatureSlotLabel(slot.label || key),
        source: normalizeSignatureSource(slot?.source),
        showDateLine: Boolean(slot?.show_date_line),
        staticName: typeof slot?.static_name === "string" ? slot.static_name.trim() : "",
        catalogNodeId: typeof slot?.catalogNodeId === "string" ? slot.catalogNodeId.trim() : "",
      };
    })
    .filter(Boolean);
  return slots.length ? slots : DEFAULT_SIGNATURE_SLOTS;
}

function normalizeSignatureBlockConfig(signatureBlock) {
  if (!signatureBlock || typeof signatureBlock !== "object") {
    return null;
  }
  const slots = (Array.isArray(signatureBlock.slots) ? signatureBlock.slots : [])
    .map((slot, index) => {
      const key = typeof slot?.key === "string" ? slot.key.trim() : "";
      const label = formatSignatureSlotLabel(slot?.label || key);
      if (!key || !label) {
        return null;
      }
      const source = normalizeSignatureSource(slot?.source);
      return {
        key,
        label,
        col: Number.isFinite(Number(slot?.col)) ? Number(slot.col) : index,
        col_span: Number.isFinite(Number(slot?.col_span)) ? Number(slot.col_span) : 1,
        source,
        static_name: typeof slot?.static_name === "string" ? slot.static_name.trim() : "",
        catalogNodeId: source === "system" ? String(slot?.catalogNodeId ?? "").trim() : "",
        show_date_line: Boolean(slot?.show_date_line),
      };
    })
    .filter(Boolean);
  if (slots.length === 0) {
    return null;
  }
  return {
    columns: Number.isFinite(Number(signatureBlock.columns)) ? Number(signatureBlock.columns) : 2,
    gap_pt: Number.isFinite(Number(signatureBlock.gap_pt)) ? Number(signatureBlock.gap_pt) : 40,
    date_line_gap_pt: Number.isFinite(Number(signatureBlock.date_line_gap_pt))
      ? Number(signatureBlock.date_line_gap_pt)
      : 14,
    slots,
  };
}

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
  const isBkmhMonthly = categoryKey === "bang-ke-mua-hang" && isMonthly;
  // ponytail: PNK always by-day (spec §4.1); no aggregation picker until multi-source modes exist
  const isPnkMonthly = categoryKey === "phieu-nhap-kho" && isMonthly;
  const showAggregationPicker = isMonthly && !isPnkMonthly;

  const [periodMonth, setPeriodMonth] = useState(() => todayYmd().slice(0, 7));
  const [periodDate, setPeriodDate] = useState(todayYmd);
  const [issueSlipId, setIssueSlipId] = useState("");
  const [selectedDataUnitIds, setSelectedDataUnitIds] = useState([]);
  const [aggregationMode, setAggregationMode] = useState(CHUNG_TU_AGGREGATION_MODES.BY_DAY);
  const effectiveAggregationMode = isPnkMonthly
    ? CHUNG_TU_AGGREGATION_MODES.BY_DAY
    : aggregationMode;
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [signatures, setSignatures] = useState({});
  const [signatureDates, setSignatureDates] = useState({});
  const [previewInfo, setPreviewInfo] = useState(null);
  const [lastBatchInfo, setLastBatchInfo] = useState(null);
  const [actionError, setActionError] = useState(null);

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
      CHUNG_TU_AGGREGATION_MODE_OPTIONS.find((o) => o.value === effectiveAggregationMode)?.label ??
      effectiveAggregationMode,
    [effectiveAggregationMode],
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
    setSelectedTemplateId("");
    setSignatures({});
    setSignatureDates({});
    setPreviewInfo(null);
    setLastBatchInfo(null);
    setActionError(null);
    setIssueSlipId("");
  }, [categoryKey]);

  const { data: templates = [], isLoading: templatesLoading } = useChungTuPdfTemplatesQuery(categoryKey, {
    skip: !categoryKey,
  });

  const selectedTemplate = useMemo(
    () => templates.find((template) => String(template.id) === String(selectedTemplateId)) ?? null,
    [selectedTemplateId, templates],
  );

  useEffect(() => {
    if (!selectedTemplateId) return;
    if (templates.some((template) => String(template.id) === String(selectedTemplateId))) return;
    setSelectedTemplateId("");
  }, [selectedTemplateId, templates]);

  const { data: templateFieldsPayload, isLoading: templateFieldsLoading } =
    useChungTuPdfTemplateFieldsQuery(selectedTemplate?.id, {
      skip: !selectedTemplate?.id,
    });
  const { data: savedSignatureSettings, isLoading: signatureSettingsLoading } =
    useChungTuSignatureSettingsQuery(categoryKey, { skip: !categoryKey });
  const { data: fieldCatalog, isLoading: fieldCatalogLoading } = useChungTuPdfFieldCatalogQuery();

  const templateSignatureBlock = useMemo(
    () => extractSignatureBlock(templateFieldsPayload),
    [templateFieldsPayload],
  );
  const savedSignatureBlock = useMemo(
    () => normalizeSignatureBlockConfig(savedSignatureSettings?.signatureBlock),
    [savedSignatureSettings?.signatureBlock],
  );
  const activeSignatureBlock = useMemo(
    () => savedSignatureBlock ?? templateSignatureBlock ?? null,
    [savedSignatureBlock, templateSignatureBlock],
  );
  const signatureSlots = useMemo(
    () => normalizeSignatureSlots(activeSignatureBlock),
    [activeSignatureBlock],
  );
  const editableSignatureSlots = useMemo(
    () => signatureSlots.filter((slot) => slot.source !== "static" && slot.source !== "system"),
    [signatureSlots],
  );
  const hasSavedSignatureConfig = Array.isArray(savedSignatureBlock?.slots);
  const signatureStateShape = useMemo(
    () =>
      editableSignatureSlots
        .map((slot) => `${slot.key}:${slot.showDateLine ? "date" : "name"}`)
        .join("|"),
    [editableSignatureSlots],
  );

  useEffect(() => {
    if (!selectedTemplate) {
      setSignatures({});
      setSignatureDates({});
      return;
    }
    setSignatures((prev) => {
      const next = {};
      for (const slot of editableSignatureSlots) {
        next[slot.key] = prev[slot.key] ?? "";
      }
      return next;
    });
    setSignatureDates((prev) => {
      const next = {};
      for (const slot of editableSignatureSlots) {
        if (slot.showDateLine) {
          next[slot.key] = prev[slot.key] ?? "";
        }
      }
      return next;
    });
  }, [selectedTemplate, signatureStateShape, editableSignatureSlots]);

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

  const [createBkmhMonthlyExport, { isLoading: creatingBkmhMonthly }] =
    useCreateChungTuBkmhMonthlyExportMutation();
  const [createPdfExportBatch, { isLoading: creatingBatch }] = useCreateChungTuPdfExportBatchMutation();
  const [previewCtx, { isLoading: previewing }] = useChungTuContextPreviewMutation();

  const buildPayloadBase = useCallback(() => {
    const base = { categoryKey, unitId: effectiveUnitId };
    if (isMonthly) {
      return {
        ...base,
        periodMonth,
        unitIds: selectedDataUnitIds,
        aggregationMode: effectiveAggregationMode,
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
    effectiveAggregationMode,
    periodDate,
    issueSlipId,
  ]);

  const handlePreview = async () => {
    if (!selectedTemplate) {
      setActionError("Chọn mẫu PDF.");
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
      setPreviewInfo({
        lineCount: data?.context?.detailRows?.length ?? 0,
        tongTien: data?.context?.tongTien ?? "",
      });
    } catch (e) {
      setActionError(e?.data?.message || e?.message || "Không xem trước được dữ liệu.");
    }
  };

  const handleCreate = async () => {
    if (!selectedTemplate) {
      setActionError("Chọn mẫu PDF.");
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
    if (templateFieldsLoading) {
      setActionError("Đang tải cấu hình chữ ký của mẫu.");
      return;
    }
    if (signatureSettingsLoading) {
      setActionError("Đang tải cài đặt chữ ký đã lưu.");
      return;
    }
    setActionError(null);
    try {
      const mutate = isBkmhMonthly ? createBkmhMonthlyExport : createPdfExportBatch;
      const result = await mutate({
        ...buildPayloadBase(),
        pdfTemplateId: Number(selectedTemplate.id),
        signatures,
        signatureDates,
        ...(activeSignatureBlock ? { signatureBlock: activeSignatureBlock } : {}),
      }).unwrap();
      if (isBkmhMonthly) {
        const monthlyId = result?.id ?? result?.monthlyId ?? "";
        const sliceCount = Number(result?.sliceCount ?? 0);
        setLastBatchInfo({
          monthlyId,
          sliceCount,
          displayName: result?.displayName ?? "",
          periodMonth: result?.periodMonth ?? periodMonth,
        });
        notifySuccess(
          `Đã lưu BKMH tháng ${formatPeriodMonth(result?.periodMonth ?? periodMonth)} (monthlyId: ${monthlyId || "—"}, sliceCount: ${sliceCount}).`,
        );
        return;
      }
      const fileCount = Number(result?.fileCount ?? 0);
      setLastBatchInfo({
        batchKey: result?.batchKey ?? "",
        fileCount,
        displayName: result?.displayName ?? "",
      });
      notifySuccess(
        fileCount > 0
          ? `Đã tạo ${fileCount} file trong folder lịch sử.`
          : "Đã tạo folder lịch sử nhưng chưa có file PDF.",
      );
    } catch (e) {
      const message = e?.data?.message || e?.message || "Không xuất được PDF.";
      setActionError(message);
      notifyError(message);
    }
  };

  const busy = creatingBkmhMonthly || creatingBatch || previewing;
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
    if (!selectedTemplate?.id) {
      setActionError("Chọn mẫu PDF.");
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
    selectedTemplate?.id,
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
  const wizardShowReview = useWizardLayout && wizardStep === 1;
  const showDesktopLayout = !useWizardLayout;
  const unitsListMaxH = useWizardLayout ? "max-h-[min(20rem,42vh)]" : "max-h-48";
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

      {showAggregationPicker ? (
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
    <div className="space-y-3">
      <label className="block min-w-0 space-y-1" htmlFor={`ct-export-template-${categoryKey}`}>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
          Mẫu PDF
        </span>
        <select
          id={`ct-export-template-${categoryKey}`}
          className={fieldClass}
          value={selectedTemplateId}
          disabled={templatesLoading || templates.length === 0}
          onChange={(e) => setSelectedTemplateId(e.target.value)}
        >
          <option value="">
            {templatesLoading
              ? "Đang tải mẫu…"
              : templates.length
                ? "— Chọn mẫu PDF —"
                : "Chưa có mẫu PDF"}
          </option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {getTemplateLabel(template)}
            </option>
          ))}
        </select>
      </label>

      {!templatesLoading && templates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          Chưa có mẫu PDF do quản trị hệ thống cấu hình. Liên hệ Superadmin để tải mẫu lên.
        </p>
      ) : null}

      {selectedTemplate ? (
        <p className="rounded-lg bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          Đã chọn: <span className="font-medium text-foreground">{getTemplateLabel(selectedTemplate)}</span>
        </p>
      ) : null}

      {selectedTemplate ? (
        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-3">
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
              Thông tin chữ ký
            </p>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              {templateFieldsLoading
                ? "Đang tải cấu hình chữ ký của mẫu…"
                : hasSavedSignatureConfig
                  ? "Đang dùng khối chữ ký đã lưu ở tab Cài đặt chữ ký."
                  : Array.isArray(templateSignatureBlock?.slots)
                    ? "Nhập tên người ký theo các vị trí mà mẫu PDF đã khai báo."
                    : "Chưa có cấu hình lưu riêng, hệ thống dùng block mặc định gồm Người lập và Thủ trưởng đơn vị."}
            </p>
          </div>

          {templateFieldsLoading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Đang đọc field chữ ký…
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {signatureSlots.map((slot) =>
                slot.source === "static" ? (
                  <div
                    key={slot.key}
                    className="rounded-lg border border-border/60 bg-background px-3 py-2 text-xs"
                  >
                    <p className="font-medium whitespace-pre-line">{slot.label}</p>
                    <p className="mt-1 text-muted-foreground">
                      Tên ký cố định{slot.staticName ? `: ${slot.staticName}` : "."}
                    </p>
                  </div>
                ) : (
                  <div key={slot.key} className="space-y-3 rounded-lg border border-border/60 bg-background p-3">
                    <label className="block space-y-1" htmlFor={`ct-signature-name-${categoryKey}-${slot.key}`}>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground whitespace-pre-line">
                        {slot.label}
                      </span>
                      <input
                        id={`ct-signature-name-${categoryKey}-${slot.key}`}
                        className={fieldClass}
                        value={signatures[slot.key] ?? ""}
                        onChange={(e) =>
                          setSignatures((prev) => ({ ...prev, [slot.key]: e.target.value }))
                        }
                        placeholder="Tên người ký"
                      />
                    </label>

                    {slot.showDateLine ? (
                      <label
                        className="block space-y-1"
                        htmlFor={`ct-signature-date-${categoryKey}-${slot.key}`}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                          Dòng ngày ký
                        </span>
                        <input
                          id={`ct-signature-date-${categoryKey}-${slot.key}`}
                          className={fieldClass}
                          value={signatureDates[slot.key] ?? ""}
                          onChange={(e) =>
                            setSignatureDates((prev) => ({ ...prev, [slot.key]: e.target.value }))
                          }
                          placeholder="Hà Nội, ngày … tháng … năm …"
                        />
                      </label>
                    ) : null}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      ) : null}

      <details className="rounded-xl border border-border/70 bg-muted/10">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium text-foreground">
          <BookOpen className="size-4 text-muted-foreground" />
          Catalog Named Range cho mẫu PDF
        </summary>
        <div className="space-y-3 border-t border-border/60 px-3 py-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Dùng các Named Range `FIELD_*` cho dữ liệu đơn và `TABLE_HEADER`/`TABLE_DATA_ROW`
            cho phần bảng dòng hàng. Panel này chỉ để tra cứu nhanh khi làm mẫu Excel.
          </p>
          {fieldCatalogLoading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Đang tải catalog field…
            </p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-border/60 bg-background p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                  Scalar fields
                </p>
                <div className="space-y-2 text-xs">
                  {(fieldCatalog?.scalarFields ?? []).map((field) => (
                    <div key={field.namedRange} className="rounded-md bg-muted/25 px-2.5 py-2">
                      <p className="font-mono text-[11px] text-foreground">{field.namedRange}</p>
                      <p className="mt-0.5 text-muted-foreground">
                        {field.fieldKey} · {field.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2 rounded-lg border border-border/60 bg-background p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                  Gợi ý tiêu đề cột bảng
                </p>
                <div className="space-y-2 text-xs">
                  {(fieldCatalog?.tableColumns ?? []).map((column, index) => (
                    <div
                      key={`${column.label}-${column.fieldKey}-${index}`}
                      className="rounded-md bg-muted/25 px-2.5 py-2"
                    >
                      <p className="font-medium text-foreground">{column.label}</p>
                      <p className="mt-0.5 text-muted-foreground">fieldKey: {column.fieldKey}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </details>
    </div>
  );

  const actionButtons = (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10 w-full gap-1.5 text-xs sm:w-auto"
        disabled={!effectiveUnitId || !canRun || busy || templateFieldsLoading}
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
          disabled={
            !effectiveUnitId || !canRun || busy || templateFieldsLoading || signatureSettingsLoading
          }
          onClick={handleCreate}
        >
          {creatingBkmhMonthly || creatingBatch ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : null}
          Xuất PDF
        </Button>
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
          {selectedTemplate ? getTemplateLabel(selectedTemplate) : "—"}
        </dd>
      </div>
      <div className="rounded-lg bg-muted/25 px-3 py-2 sm:col-span-2">
        <dt className="text-[10px] uppercase text-muted-foreground">Chữ ký</dt>
        <dd className="mt-0.5 text-xs leading-snug text-foreground">
          {editableSignatureSlots.length
            ? editableSignatureSlots
                .map((slot) => `${slot.label.replace(/\n/g, " / ")}: ${signatures[slot.key] || "—"}`)
                .join(" · ")
            : "Mẫu dùng tên ký cố định."}
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
            title="Mẫu PDF & chữ ký"
            description="Chọn mẫu xuất PDF, nhập người ký và tải mẫu mới nếu cần."
          >
            {templatePickerBlock}
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
            title="Mẫu PDF & chữ ký"
            description="Chọn mẫu và chuẩn bị thông tin người ký trước khi xuất file."
            expanded={expandedCards}
          >
            {templatePickerBlock}
          </ChungTuExportWizardCard>
        </>
      ) : null}

      {wizardShowReview ? (
        <>
          <ChungTuExportWizardCard title="Tóm tắt" expanded={expandedCards} bodyClassName="py-3">
            {wizardSummary}
          </ChungTuExportWizardCard>

          <ChungTuExportWizardCard
            title="Kiểm tra trước khi xuất"
            description="Xem trước dữ liệu LTTP rồi xuất PDF từ mẫu đã chọn."
            expanded={expandedCards}
            bodyClassName="space-y-4"
          >
            <p className="text-xs leading-relaxed text-muted-foreground">
              Bước này giữ nguyên phần xem trước dữ liệu trước khi tải file PDF từ mẫu đã chọn.
            </p>
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
          Xem trước: {previewInfo.lineCount} dòng dữ liệu · Tổng {previewInfo.tongTien || "0"} đ
        </p>
      ) : null}

      {lastBatchInfo ? (
        <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground">
          {lastBatchInfo.monthlyId ? (
            <>
              Đã lưu BKMH tháng {formatPeriodMonth(lastBatchInfo.periodMonth)} (monthlyId:{" "}
              {lastBatchInfo.monthlyId}, sliceCount: {lastBatchInfo.sliceCount})
              {lastBatchInfo.displayName ? ` "${lastBatchInfo.displayName}"` : ""}. Mở tab Lịch sử để
              in tất cả, tải zip hoặc xem tổng hợp slice.
            </>
          ) : (
            <>
              Đã tạo {lastBatchInfo.fileCount} file trong folder lịch sử
              {lastBatchInfo.displayName ? ` "${lastBatchInfo.displayName}"` : ""}. Mở tab Lịch sử để
              tải zip, tải từng file hoặc in gộp.
            </>
          )}
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
