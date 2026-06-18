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
  useCreateChungTuDocumentMutation,
  useOpenChungTuDocumentMutation,
  useSyncChungTuDocumentMutation,
} from "@/features/chung-tu-quyet-toan/api/chungTuDocumentApi";
import { readStoredManualUnitId, writeStoredManualUnitId } from "@/pages/lttpNhapXuat/lttpNhapXuatSessionPersist";
import {
  resolveDefaultLttpStorageUnitId,
  unitsForLttpUnitPicker,
} from "@/pages/lttpNhapXuat/lttpStorageUnitDefault";
import { ChungTuTemplateMappingPanel } from "@/pages/chungTuQuyetToan/ChungTuTemplateMappingPanel";

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
  const [soChungTu, setSoChungTu] = useState("");
  const [previewInfo, setPreviewInfo] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [lastOpenedLink, setLastOpenedLink] = useState(null);

  const { data: templatesPayload, isLoading: templatesLoading } = useChungTuCategoryTemplatesQuery(
    categoryKey,
  );
  const templates = templatesPayload?.items ?? [];

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
    { skip: !effectiveUnitId },
  );

  const [createDoc, { isLoading: creating }] = useCreateChungTuDocumentMutation();
  const [syncDoc, { isLoading: syncing }] = useSyncChungTuDocumentMutation();
  const [openDoc, { isLoading: openingDoc }] = useOpenChungTuDocumentMutation();
  const [deleteDoc, { isLoading: deletingDoc }] = useDeleteChungTuDocumentMutation();
  const [previewCtx, { isLoading: previewing }] = useChungTuContextPreviewMutation();

  const documentSettings = useMemo(
    () => (soChungTu.trim() ? { soChungTu: soChungTu.trim() } : {}),
    [soChungTu],
  );

  const buildPayloadBase = useCallback(
    () => {
      if (isBangKeMuaHang) {
        return {
          categoryKey,
          unitId: effectiveUnitId,
          periodMonth,
          unitIds: selectedBkmhUnitIds,
          settings: documentSettings,
        };
      }
      return {
        categoryKey,
        unitId: effectiveUnitId,
        periodDate,
        issueSlipId: mode === "by-slip" && issueSlipId ? Number(issueSlipId) : undefined,
        settings: documentSettings,
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
      documentSettings,
    ],
  );

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

  const busy = creating || syncing || previewing || openingDoc || deletingDoc;
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
            Mẫu Google Sheets (Drive hệ thống)
          </h3>
          {templatesPayload?.folderWebViewLink ? (
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
        {templatesLoading ? (
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

      <div className="rounded-xl border border-border/80 bg-card/40 p-3">
        <label className="block space-y-1" htmlFor={`ct-so-${categoryKey}`}>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
            Số chứng từ (tùy chọn)
          </span>
          <input
            id={`ct-so-${categoryKey}`}
            type="text"
            className="w-full max-w-xs rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
            value={soChungTu}
            onChange={(e) => setSoChungTu(e.target.value)}
            placeholder="Để trống nếu template tự ghi số"
          />
          <p className="text-[10px] text-muted-foreground">
            Ngày tháng năm và tổng tiền bằng chữ được app tính tự động khi đồng bộ.
          </p>
        </label>
      </div>

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
        {canWrite ? (
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
    </div>
  );
}
