"use client";

import { ExternalLink, Loader2, Printer, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { useCurrentUser, useHasPermission } from "@/features/auth/model/authSlice";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import { useGetUnitsQuery } from "@/features/units/api/unitsApi";
import { useTargetUnitScope } from "@/contexts/TargetUnitScopeContext";
import { useGetLttpIssueSlipsQuery } from "@/features/lttp/api/lttpApi";
import {
  buildChungTuDocumentPrintPdfUrl,
  useChungTuCategoryTemplatesQuery,
  useChungTuContextPreviewMutation,
  useDeleteChungTuDocumentMutation,
  useChungTuDocumentsQuery,
  useChungTuExcelExportHistoryQuery,
  useChungTuExcelTemplatesQuery,
  useChungTuUnitProfileQuery,
  useCreateChungTuDocumentMutation,
  useExportBkmhExcelMutation,
  useOpenChungTuDocumentMutation,
  usePutChungTuUnitProfileMutation,
  usePutChungTuExcelTemplateMappingMutation,
  useSyncChungTuDocumentMutation,
  useUploadChungTuExcelTemplateMutation,
} from "@/features/chung-tu-quyet-toan/api/chungTuDocumentApi";
import { readStoredManualUnitId, writeStoredManualUnitId } from "@/pages/lttpNhapXuat/lttpNhapXuatSessionPersist";
import {
  resolveDefaultLttpStorageUnitId,
  unitsForLttpUnitPicker,
} from "@/pages/lttpNhapXuat/lttpStorageUnitDefault";
import { ChungTuTemplateMappingPanel } from "@/pages/chungTuQuyetToan/ChungTuTemplateMappingPanel";
import {
  getChungTuCategoryProfilePersistKeys,
  getChungTuCategorySettingsFields,
} from "@/pages/chungTuQuyetToan/chungTuCategorySettingsFields";

const EXCEL_DETAIL_COLUMNS = [
  { key: "", label: "Không fill" },
  { key: "stt", label: "STT" },
  { key: "tenHang", label: "Tên mặt hàng" },
  { key: "dvt", label: "Đơn vị tính" },
  { key: "nguoiBan", label: "Người bán" },
  { key: "soLuong", label: "Số lượng" },
  { key: "donGia", label: "Giá" },
  { key: "thanhTien", label: "Thành tiền" },
  { key: "ghiChu", label: "Ghi chú" },
];

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sameNumberArray(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (Number(a[i]) !== Number(b[i])) return false;
  }
  return true;
}

function profileValueOrEmpty(profile, key) {
  const v = profile?.[key];
  return v != null ? String(v) : "";
}

function buildSettingsFromProfile(profile, categoryKey) {
  const fields = getChungTuCategorySettingsFields(categoryKey);
  const next = {};
  for (const f of fields) {
    if (f.key === "donViSo") {
      next.donViSo = profileValueOrEmpty(profile, "donViSo") || profile?.unitName || "";
    } else {
      next[f.key] = profileValueOrEmpty(profile, f.key);
    }
  }
  if (!Object.prototype.hasOwnProperty.call(next, "soChungTu")) {
    next.soChungTu = "";
  }
  if (!Object.prototype.hasOwnProperty.call(next, "ghiChu")) {
    next.ghiChu = "";
  }
  return next;
}

function defaultExcelMapping(template) {
  const sheetName = template?.metadata?.sheets?.[0]?.name ?? "";
  const firstHeader = template?.metadata?.sheets?.[0]?.headerRows?.[0];
  return (
    template?.mapping ?? {
      version: 1,
      fieldTargets: [],
      table: {
        sheetName,
        headerRow: firstHeader?.rowNumber ?? 8,
        startRow: firstHeader?.rowNumber ? firstHeader.rowNumber + 1 : 9,
        templateRow: firstHeader?.rowNumber ? firstHeader.rowNumber + 1 : 9,
        startCol: 1,
        columns: (firstHeader?.cells?.length ? firstHeader.cells : EXCEL_DETAIL_COLUMNS.slice(1, 8)).map(
          (col, index) => ({
            col: col.col ?? index + 1,
            label: col.label ?? "",
            fieldKey: col.fieldKey ?? col.key ?? "",
          }),
        ),
      },
      pagination: {
        enabled: true,
        amountFieldKey: "thanhTien",
        labelFieldKey: "tenHang",
        carryInLabel: "Mang sang",
        carryOutLabel: "Cộng sang trang",
      },
    }
  );
}

function selectedExcelSheet(template, mapping) {
  const sheetName = mapping?.table?.sheetName;
  return (
    template?.metadata?.sheets?.find((sheet) => sheet.name === sheetName) ??
    template?.metadata?.sheets?.[0] ??
    null
  );
}

function headerRowsForSelectedSheet(template, mapping) {
  return selectedExcelSheet(template, mapping)?.headerRows ?? [];
}

function columnsFromHeaderRow(headerRow) {
  return (headerRow?.cells ?? []).map((cell) => ({
    col: cell.col,
    label: cell.label,
    fieldKey: cell.fieldKey ?? "",
  }));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function statusBadge(status) {
  if (status === "synced") {
    return (
      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
        Đã đồng bộ
      </span>
    );
  }
  if (status === "stale") {
    return (
      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
        Cần đồng bộ lại
      </span>
    );
  }
  if (status === "locked") {
    return (
      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        Đã khóa
      </span>
    );
  }
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      Chưa đồng bộ
    </span>
  );
}

/**
 * @param {{ categoryKey: string, mode: "by-date"|"by-slip", subtitle?: string }} props
 */
export function ChungTuDocumentWorkspace({ categoryKey, mode, subtitle }) {
  const user = useCurrentUser();
  const canWrite = useHasPermission(PERMISSIONS.LTTP_ISSUE_SLIPS_WRITE);
  const canPickUnits = useHasPermission(PERMISSIONS.UNITS_READ);
  const { workingUnitId, isPrivileged } = useTargetUnitScope();
  const isBangKeMuaHang = categoryKey === "bang-ke-mua-hang";

  const { data: unitsData } = useGetUnitsQuery(undefined, { skip: !canPickUnits });
  const units = unitsData ?? [];
  const defaultUnitId = user?.unit?.id != null ? Number(user.unit.id) : null;

  const unitsForDropdown = useMemo(
    () =>
      unitsForLttpUnitPicker(units, {
        defaultUnitId,
        isPrivileged,
        userUnitName: user?.unit?.name,
      }),
    [units, defaultUnitId, isPrivileged, user?.unit?.name],
  );

  const selectedUnitId = useMemo(() => {
    if (!canPickUnits) return defaultUnitId;
    if (workingUnitId != null) return Number(workingUnitId);
    const fallback =
      !isPrivileged && defaultUnitId != null
        ? defaultUnitId
        : units.length
          ? units[0]?.id
          : defaultUnitId;
    return resolveDefaultLttpStorageUnitId(unitsForDropdown, fallback);
  }, [canPickUnits, defaultUnitId, isPrivileged, workingUnitId, units, unitsForDropdown]);

  const [manualUnitId, setManualUnitId] = useState(null);
  const effectiveUnitId = manualUnitId ?? selectedUnitId;

  useEffect(() => {
    if (!canPickUnits || !unitsForDropdown.length) return;
    const stored = readStoredManualUnitId();
    if (stored == null) return;
    const allowedIds = new Set(unitsForDropdown.map((u) => Number(u.id)));
    if (allowedIds.has(Number(stored))) {
      setManualUnitId(stored);
    }
  }, [canPickUnits, unitsForDropdown]);

  const persistManualUnitId = useCallback((id) => {
    setManualUnitId(id);
    writeStoredManualUnitId(id);
  }, []);

  const [periodDate, setPeriodDate] = useState(todayYmd);
  const [periodMonth, setPeriodMonth] = useState(() => todayYmd().slice(0, 7));
  const [issueSlipId, setIssueSlipId] = useState("");
  const [selectedBkmhUnitIds, setSelectedBkmhUnitIds] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedExcelTemplateId, setSelectedExcelTemplateId] = useState("");
  const [excelUploadName, setExcelUploadName] = useState("");
  const [excelUploadFile, setExcelUploadFile] = useState(null);
  const [excelMappingDraft, setExcelMappingDraft] = useState(null);
  const [settings, setSettings] = useState({});
  const [previewInfo, setPreviewInfo] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [lastOpenedLink, setLastOpenedLink] = useState(null);

  const { data: templatesPayload, isLoading: templatesLoading } = useChungTuCategoryTemplatesQuery(
    categoryKey,
    { skip: isBangKeMuaHang },
  );
  const templates = templatesPayload?.items ?? [];
  const { data: excelTemplates = [], isLoading: excelTemplatesLoading } = useChungTuExcelTemplatesQuery(
    categoryKey,
    { skip: !isBangKeMuaHang },
  );
  const { data: excelHistory = [] } = useChungTuExcelExportHistoryQuery(categoryKey, {
    skip: !isBangKeMuaHang,
  });

  const { data: profile, isLoading: profileLoading } = useChungTuUnitProfileQuery(effectiveUnitId, {
    skip: !effectiveUnitId || isBangKeMuaHang,
  });

  const settingsFields = useMemo(
    () => (isBangKeMuaHang ? [] : getChungTuCategorySettingsFields(categoryKey)),
    [categoryKey, isBangKeMuaHang],
  );

  useEffect(() => {
    if (isBangKeMuaHang) return;
    if (!profile) return;
    setSettings((prev) => {
      const fromProfile = buildSettingsFromProfile(profile, categoryKey);
      const next = { ...fromProfile };
      for (const f of getChungTuCategorySettingsFields(categoryKey)) {
        const k = f.key;
        if (prev[k] != null && String(prev[k]).trim() !== "") {
          next[k] = prev[k];
        }
      }
      return next;
    });
  }, [profile, categoryKey, isBangKeMuaHang]);

  const slipFrom = mode === "by-slip" ? periodDate : undefined;
  const slipTo = mode === "by-slip" ? periodDate : undefined;
  const { data: slipsPayload, isLoading: slipsLoading } = useGetLttpIssueSlipsQuery(
    {
      unitId: effectiveUnitId,
      from: slipFrom,
      to: slipTo,
      page: 1,
      pageSize: 50,
    },
    { skip: mode !== "by-slip" || !effectiveUnitId || !periodDate },
  );
  const slips = slipsPayload?.items ?? [];
  const bkmhAllowedUnitIds = useMemo(
    () => unitsForDropdown.map((u) => Number(u.id)).filter(Number.isFinite),
    [unitsForDropdown],
  );

  useEffect(() => {
    if (!isBangKeMuaHang) return;
    if (!bkmhAllowedUnitIds.length) {
      if (effectiveUnitId != null) {
        const fallbackIds = [Number(effectiveUnitId)];
        setSelectedBkmhUnitIds((prev) => (sameNumberArray(prev, fallbackIds) ? prev : fallbackIds));
      }
      return;
    }
    setSelectedBkmhUnitIds((prev) => {
      const allowed = new Set(bkmhAllowedUnitIds);
      const kept = prev.filter((id) => allowed.has(Number(id)));
      const next = kept.length ? kept : bkmhAllowedUnitIds;
      return sameNumberArray(prev, next) ? prev : next;
    });
  }, [bkmhAllowedUnitIds, effectiveUnitId, isBangKeMuaHang]);

  const { data: documents = [], isLoading: docsLoading } = useChungTuDocumentsQuery(
    { unitId: effectiveUnitId, categoryKey },
    { skip: !effectiveUnitId || isBangKeMuaHang },
  );

  const [putProfile, { isLoading: savingProfile }] = usePutChungTuUnitProfileMutation();
  const [createDoc, { isLoading: creating }] = useCreateChungTuDocumentMutation();
  const [syncDoc, { isLoading: syncing }] = useSyncChungTuDocumentMutation();
  const [openDoc, { isLoading: openingDoc }] = useOpenChungTuDocumentMutation();
  const [deleteDoc, { isLoading: deletingDoc }] = useDeleteChungTuDocumentMutation();
  const [previewCtx, { isLoading: previewing }] = useChungTuContextPreviewMutation();
  const [uploadExcelTemplate, { isLoading: uploadingExcel }] = useUploadChungTuExcelTemplateMutation();
  const [putExcelMapping, { isLoading: savingExcelMapping }] =
    usePutChungTuExcelTemplateMappingMutation();
  const [exportExcel, { isLoading: exportingExcel }] = useExportBkmhExcelMutation();

  const selectedExcelTemplate = useMemo(
    () => excelTemplates.find((item) => Number(item.id) === Number(selectedExcelTemplateId)) ?? null,
    [excelTemplates, selectedExcelTemplateId],
  );
  const selectedExcelHeaderRows = useMemo(
    () => headerRowsForSelectedSheet(selectedExcelTemplate, excelMappingDraft),
    [excelMappingDraft, selectedExcelTemplate],
  );

  useEffect(() => {
    if (!isBangKeMuaHang) return;
    if (!selectedExcelTemplateId && excelTemplates.length > 0) {
      setSelectedExcelTemplateId(String(excelTemplates[0].id));
    }
  }, [excelTemplates, isBangKeMuaHang, selectedExcelTemplateId]);

  useEffect(() => {
    if (!selectedExcelTemplate) {
      setExcelMappingDraft(null);
      return;
    }
    setExcelMappingDraft(defaultExcelMapping(selectedExcelTemplate));
  }, [selectedExcelTemplate]);

  const buildPayloadBase = useCallback(
    () => {
      if (isBangKeMuaHang) {
        return {
          categoryKey,
          unitId: effectiveUnitId,
          periodMonth,
          unitIds: selectedBkmhUnitIds,
        };
      }
      return {
        categoryKey,
        unitId: effectiveUnitId,
        periodDate,
        issueSlipId: mode === "by-slip" && issueSlipId ? Number(issueSlipId) : undefined,
        settings,
      };
    },
    [
      categoryKey,
      effectiveUnitId,
      isBangKeMuaHang,
      mode,
      periodDate,
      periodMonth,
      issueSlipId,
      selectedBkmhUnitIds,
      settings,
    ],
  );

  const handleSaveProfile = async () => {
    if (!effectiveUnitId) return;
    setActionError(null);
    const persistKeys = getChungTuCategoryProfilePersistKeys(categoryKey);
    const body = { unitId: effectiveUnitId };
    for (const key of persistKeys) {
      body[key] = settings[key]?.trim() ? settings[key].trim() : null;
    }
    try {
      await putProfile(body);
    } catch (e) {
      setActionError(e?.data?.message || e?.message || "Không lưu được mẫu đơn vị.");
    }
  };

  const handlePreview = async () => {
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
    if (!selectedTemplateId) {
      setActionError("Chọn mẫu Google Sheets trong thư mục Drive.");
      return;
    }
    if (mode === "by-slip" && !issueSlipId) {
      setActionError("Chọn phiếu xuất LTTP.");
      return;
    }
    if (isBangKeMuaHang && selectedBkmhUnitIds.length === 0) {
      setActionError("Chọn ít nhất một đơn vị để đưa dữ liệu vào BKMH.");
      return;
    }
    setActionError(null);
    try {
      const result = await createDoc({
        ...buildPayloadBase(),
        templateDriveFileId: selectedTemplateId,
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

  const handlePrintDocument = (doc) => {
    setActionError(null);
    window.open(buildChungTuDocumentPrintPdfUrl(doc.documentKey), "_blank", "noopener,noreferrer");
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

  const handleExcelUpload = async () => {
    if (!excelUploadFile) {
      setActionError("Chọn file .xlsx để upload.");
      return;
    }
    setActionError(null);
    try {
      const result = await uploadExcelTemplate({
        categoryKey,
        displayName: excelUploadName || excelUploadFile.name,
        file: excelUploadFile,
      });
      setSelectedExcelTemplateId(String(result?.id ?? ""));
      setExcelUploadFile(null);
      setExcelUploadName("");
    } catch (e) {
      setActionError(e?.data?.message || e?.message || "Không upload được template Excel.");
    }
  };

  const updateExcelTableMapping = (patch) => {
    setExcelMappingDraft((prev) => ({
      ...(prev ?? defaultExcelMapping(selectedExcelTemplate)),
      table: {
        ...((prev ?? defaultExcelMapping(selectedExcelTemplate)).table ?? {}),
        ...patch,
      },
    }));
  };

  const updateExcelPagination = (patch) => {
    setExcelMappingDraft((prev) => ({
      ...(prev ?? defaultExcelMapping(selectedExcelTemplate)),
      pagination: {
        ...((prev ?? defaultExcelMapping(selectedExcelTemplate)).pagination ?? {}),
        ...patch,
      },
    }));
  };

  const handleSaveExcelMapping = async () => {
    if (!selectedExcelTemplate || !excelMappingDraft) return;
    setActionError(null);
    try {
      await putExcelMapping({
        id: selectedExcelTemplate.id,
        mapping: {
          ...excelMappingDraft,
          fieldTargets: [],
        },
        isActive: selectedExcelTemplate.isActive,
      });
    } catch (e) {
      setActionError(e?.data?.message || e?.message || "Không lưu được mapping Excel.");
    }
  };

  const handleExportExcel = async () => {
    if (!selectedExcelTemplateId) {
      setActionError("Chọn template Excel.");
      return;
    }
    if (!effectiveUnitId || selectedBkmhUnitIds.length === 0) {
      setActionError("Chọn đơn vị và ít nhất một đơn vị đưa dữ liệu vào BKMH.");
      return;
    }
    setActionError(null);
    try {
      const result = await exportExcel({
        templateId: Number(selectedExcelTemplateId),
        unitId: Number(effectiveUnitId),
        periodMonth,
        unitIds: selectedBkmhUnitIds,
      });
      downloadBlob(result.blob, result.filename);
    } catch (e) {
      setActionError(e?.data?.message || e?.message || "Không xuất được file Excel.");
    }
  };

  const busy =
    creating ||
    syncing ||
    previewing ||
    savingProfile ||
    openingDoc ||
    deletingDoc ||
    uploadingExcel ||
    savingExcelMapping ||
    exportingExcel;
  const canRunBkmh = !isBangKeMuaHang || selectedBkmhUnitIds.length > 0;

  return (
    <div className="space-y-4 p-3 sm:p-4">
      {subtitle ? (
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      ) : null}

      <div className="grid gap-3 rounded-xl border border-border/80 bg-card/40 p-3 sm:grid-cols-2">
        {canPickUnits && unitsForDropdown.length > 0 && effectiveUnitId != null ? (
          <label className="min-w-0 space-y-1 sm:col-span-2" htmlFor={`ct-unit-${categoryKey}`}>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
              Đơn vị kho LTTP
            </span>
            <select
              id={`ct-unit-${categoryKey}`}
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

        {isBangKeMuaHang ? (
          <label className="space-y-1" htmlFor={`ct-month-${categoryKey}`}>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
              Tháng chứng từ
            </span>
            <input
              id={`ct-month-${categoryKey}`}
              type="month"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              value={periodMonth}
              onChange={(e) => setPeriodMonth(e.target.value)}
            />
          </label>
        ) : (
          <label className="space-y-1" htmlFor={`ct-date-${categoryKey}`}>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
            {mode === "by-slip" ? "Ngày phiếu xuất" : "Ngày chứng từ"}
          </span>
          <input
            id={`ct-date-${categoryKey}`}
            type="date"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            value={periodDate}
            onChange={(e) => setPeriodDate(e.target.value)}
          />
          </label>
        )}

        {mode === "by-slip" ? (
          <label className="space-y-1" htmlFor={`ct-slip-${categoryKey}`}>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
              Phiếu xuất LTTP
            </span>
            <select
              id={`ct-slip-${categoryKey}`}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              value={issueSlipId}
              onChange={(e) => setIssueSlipId(e.target.value)}
              disabled={slipsLoading}
            >
              <option value="">— Chọn phiếu —</option>
              {slips.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.bookMmyy}-{String(s.slipNo).padStart(4, "0")}
                  {s.recipientDisplayName ? ` · ${s.recipientDisplayName}` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {isBangKeMuaHang && unitsForDropdown.length > 0 ? (
          <div className="space-y-2 sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                Đơn vị đưa dữ liệu vào BKMH
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-[11px] text-primary hover:underline"
                  onClick={() =>
                    setSelectedBkmhUnitIds(
                      unitsForDropdown.map((u) => Number(u.id)).filter(Number.isFinite),
                    )
                  }
                >
                  Chọn tất cả
                </button>
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                  onClick={() => setSelectedBkmhUnitIds([])}
                >
                  Bỏ chọn
                </button>
              </div>
            </div>
            <div className="grid max-h-48 gap-1 overflow-auto rounded-lg border border-border bg-background/60 p-2 sm:grid-cols-2">
              {unitsForDropdown.map((u) => {
                const id = Number(u.id);
                const checked = selectedBkmhUnitIds.includes(id);
                return (
                  <label
                    key={u.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedBkmhUnitIds((prev) => {
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
            <p className="text-[10px] text-muted-foreground">
              Mặc định chọn toàn bộ đơn vị bạn có quyền xem. Backend sẽ tạo 1 file tháng, mỗi ngày 1 sheet.
            </p>
          </div>
        ) : null}
      </div>

      <div className="space-y-2 rounded-xl border border-border/80 bg-card/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            {isBangKeMuaHang ? "Mẫu Excel local" : "Mẫu Google Sheets (Drive hệ thống)"}
          </h3>
          {!isBangKeMuaHang && templatesPayload?.folderWebViewLink ? (
            <a
              href={templatesPayload.folderWebViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              Mở thư mục
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
        {isBangKeMuaHang ? (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                type="text"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="Tên template hiển thị"
                value={excelUploadName}
                onChange={(e) => setExcelUploadName(e.target.value)}
              />
              <input
                type="file"
                accept=".xlsx"
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
                onChange={(e) => setExcelUploadFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canWrite || uploadingExcel || !excelUploadFile}
                onClick={handleExcelUpload}
              >
                {uploadingExcel ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Upload
              </Button>
            </div>
            {excelTemplatesLoading ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Đang tải template Excel…
              </p>
            ) : excelTemplates.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Chưa có template Excel local. Upload file .xlsx BKMH để bắt đầu mapping.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {excelTemplates.map((t) => (
                  <label
                    key={t.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm transition",
                      Number(selectedExcelTemplateId) === Number(t.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <input
                      type="radio"
                      name={`excel-template-${categoryKey}`}
                      className="mt-1"
                      checked={Number(selectedExcelTemplateId) === Number(t.id)}
                      onChange={() => setSelectedExcelTemplateId(String(t.id))}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{t.displayName}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {t.originalFilename} · {t.metadata?.sheets?.length ?? 0} sheet ·{" "}
                        {t.metadata?.definedNames?.length ?? 0} named range
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            {selectedExcelTemplate && excelMappingDraft ? (
              <div className="space-y-3 rounded-lg border border-border/80 bg-background/60 p-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">Sheet bảng</span>
                    <select
                      className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                      value={excelMappingDraft.table?.sheetName ?? ""}
                      onChange={(e) => {
                        const sheet = selectedExcelTemplate.metadata?.sheets?.find(
                          (item) => item.name === e.target.value,
                        );
                        const header = sheet?.headerRows?.[0];
                        updateExcelTableMapping({
                          sheetName: e.target.value,
                          headerRow: header?.rowNumber ?? 8,
                          startRow: header?.rowNumber ? header.rowNumber + 1 : 9,
                          templateRow: header?.rowNumber ? header.rowNumber + 1 : 9,
                          columns: columnsFromHeaderRow(header),
                        });
                      }}
                    >
                      {(selectedExcelTemplate.metadata?.sheets ?? []).map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">Hàng tiêu đề nhận diện</span>
                    <select
                      className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                      value={excelMappingDraft.table?.headerRow ?? ""}
                      onChange={(e) => {
                        const rowNumber = Number(e.target.value);
                        const header = selectedExcelHeaderRows.find((row) => Number(row.rowNumber) === rowNumber);
                        updateExcelTableMapping({
                          headerRow: rowNumber,
                          startRow: rowNumber + 1,
                          templateRow: rowNumber + 1,
                          columns: columnsFromHeaderRow(header),
                        });
                      }}
                    >
                      {selectedExcelHeaderRows.length === 0 ? (
                        <option value="">Không nhận diện được hàng tiêu đề</option>
                      ) : null}
                      {selectedExcelHeaderRows.map((row) => (
                        <option key={row.rowNumber} value={row.rowNumber}>
                          Hàng {row.rowNumber}: {row.cells.map((cell) => cell.label).join(" | ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">Dòng dữ liệu đầu tiên</span>
                    <input
                      type="number"
                      min="1"
                      className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                      value={excelMappingDraft.table?.startRow ?? 9}
                      onChange={(e) =>
                        updateExcelTableMapping({
                          startRow: Number(e.target.value),
                          templateRow: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(excelMappingDraft.table?.columns ?? []).map((col, index) => (
                    <label key={`${col.col}-${index}`} className="space-y-1">
                      <span className="text-[10px] text-muted-foreground">
                        Cột {col.col}
                        {col.label ? ` · ${col.label}` : ""}
                      </span>
                      <select
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                        value={col.fieldKey ?? ""}
                        onChange={(e) => {
                          const next = [...(excelMappingDraft.table?.columns ?? [])];
                          next[index] = { ...col, fieldKey: e.target.value };
                          updateExcelTableMapping({ columns: next });
                        }}
                      >
                        {EXCEL_DETAIL_COLUMNS.map((opt) => (
                          <option key={opt.key || "none"} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="space-y-2 rounded-lg border border-border/70 bg-background/40 p-3">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={excelMappingDraft.pagination?.enabled !== false}
                      onChange={(e) => updateExcelPagination({ enabled: e.target.checked })}
                    />
                    Tự chèn dòng Mang sang / Cộng sang trang theo ngắt trang ước lượng từ template
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-[10px] text-muted-foreground">Cột hiển thị nhãn</span>
                      <select
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                        value={excelMappingDraft.pagination?.labelFieldKey ?? "tenHang"}
                        onChange={(e) => updateExcelPagination({ labelFieldKey: e.target.value })}
                      >
                        {EXCEL_DETAIL_COLUMNS.filter((opt) => opt.key).map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] text-muted-foreground">Cột hiển thị tiền</span>
                      <select
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                        value={excelMappingDraft.pagination?.amountFieldKey ?? "thanhTien"}
                        onChange={(e) => updateExcelPagination({ amountFieldKey: e.target.value })}
                      >
                        {EXCEL_DETAIL_COLUMNS.filter((opt) => opt.key).map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    App đọc margin, row height, column width và wrap text từ template để ước lượng vị trí ngắt trang khi fill từng sheet ngày.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canWrite || savingExcelMapping}
                    onClick={handleSaveExcelMapping}
                  >
                    {savingExcelMapping ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Lưu mapping Excel
                  </Button>
                  <p className="text-[10px] text-muted-foreground">
                    Chỉ các cột được chọn field mới được fill từ dữ liệu nhập xuất LTTP; chữ ký/thông tin in giữ nguyên trong template.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        ) : templatesLoading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Đang tải danh sách mẫu…
          </p>
        ) : templates.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Chưa có mẫu trong thư mục{" "}
            <span className="font-mono text-[10px]">{categoryKey}</span>. Superadmin upload file
            .xlsx lên Drive hệ thống.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {templates.map((t) => (
              <label
                key={t.driveFileId}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm transition",
                  selectedTemplateId === t.driveFileId
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40",
                )}
              >
                <input
                  type="radio"
                  name={`template-${categoryKey}`}
                  className="mt-1"
                  checked={selectedTemplateId === t.driveFileId}
                  onChange={() => setSelectedTemplateId(t.driveFileId)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.driveFileName}</span>
                  {t.webViewLink ? (
                    <a
                      href={t.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Xem mẫu
                    </a>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        )}
        {selectedTemplateId ? (
          <ChungTuTemplateMappingPanel
            categoryKey={categoryKey}
            driveFileId={selectedTemplateId}
            canWrite={canWrite}
          />
        ) : null}
      </div>

      {!isBangKeMuaHang ? (
        <div className="space-y-2 rounded-xl border border-border/80 bg-card/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
              Thông tin in / chữ ký
            </h3>
            {canWrite ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!effectiveUnitId || busy || profileLoading}
                onClick={handleSaveProfile}
              >
                Lưu mặc định đơn vị
              </Button>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {settingsFields.map((f) => (
              <label
                key={f.key}
                className={cn("space-y-1", f.full ? "sm:col-span-2" : undefined)}
                htmlFor={`ct-set-${categoryKey}-${f.key}`}
              >
                <span className="text-[10px] text-muted-foreground">{f.label}</span>
                <input
                  id={`ct-set-${categoryKey}-${f.key}`}
                  type="text"
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                  value={settings[f.key] ?? ""}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {actionError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {actionError}
        </p>
      ) : null}

      {previewInfo ? (
        <p className="text-xs text-muted-foreground">
          Xem trước: {previewInfo.lineCount} dòng · Tổng {previewInfo.tongTien || "0"} đ
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!effectiveUnitId || !canRunBkmh || busy}
          onClick={handlePreview}
        >
          {previewing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Xem trước dữ liệu LTTP
        </Button>
        {isBangKeMuaHang ? (
          <Button
            type="button"
            size="sm"
            disabled={!effectiveUnitId || !canRunBkmh || busy || !selectedExcelTemplateId}
            onClick={handleExportExcel}
          >
            {exportingExcel ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Xuất Excel tải về
          </Button>
        ) : canWrite ? (
          <Button
            type="button"
            size="sm"
            disabled={!effectiveUnitId || !canRunBkmh || busy}
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

      {isBangKeMuaHang ? (
        <div className="space-y-2 rounded-xl border border-border/80 bg-card/40 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Lịch sử xuất Excel
          </h3>
          {excelHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground">Chưa có lần xuất Excel nào.</p>
          ) : (
            <ul className="divide-y divide-border/70">
              {excelHistory.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.periodMonth}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {item.lineCount} dòng · Tổng {Number(item.totalAmount || 0).toLocaleString("vi-VN")} đ
                      </span>
                    </div>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {item.templateName || `Template #${item.templateId}`} ·{" "}
                      {item.createdAt ? new Date(item.createdAt).toLocaleString("vi-VN") : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
      <div className="space-y-2 rounded-xl border border-border/80 bg-card/40 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
          Chứng từ đã tạo
        </h3>
        {docsLoading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Đang tải…
          </p>
        ) : documents.length === 0 ? (
          <p className="text-xs text-muted-foreground">Chưa có chứng từ nào cho đơn vị này.</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {documents.map((doc) => (
              <li key={doc.documentKey} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {isBangKeMuaHang
                        ? doc.settingsJson?.__periodMonth || doc.periodDate?.slice(0, 7) || doc.documentKey
                        : doc.periodDate || (doc.issueSlipId ? `PX #${doc.issueSlipId}` : doc.documentKey)}
                    </span>
                    {statusBadge(doc.status)}
                  </div>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {doc.templateName || doc.templateDriveFileId}
                  </p>
                </div>
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
                {isBangKeMuaHang ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePrintDocument(doc)}
                  >
                    <Printer className="mr-1 h-3 w-3" />
                    In PDF
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
              </li>
            ))}
          </ul>
        )}
      </div>
      )}
    </div>
  );
}
