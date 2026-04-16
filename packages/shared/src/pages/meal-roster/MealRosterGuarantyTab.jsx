import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardPaste, Download, Eye, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  useCopyMealRosterPreviousMutation,
  useCreateMealRosterEntryMutation,
  useDeleteMealRosterEntryMutation,
  useGetMealRosterMetaQuery,
  useGetMealRosterQuery,
  useImportMealRosterMutation,
  usePatchMealRosterEntryMutation,
} from "@/features/meal-roster/api/mealRosterApi";
import { useConfirm } from "@/contexts/ConfirmProvider";
import httpClient from "@/services/httpClient";
import { notifyError, notifySuccess } from "@/services/notify";
import { cn } from "@/utils/cn";
import {
  formatMealAmountOnly,
  MealRateDetailTooltipContent,
  periodAmountsForRate,
  prevYearMonthLabel,
} from "./mealRosterUiUtils";

const inputClass =
  "w-full min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

const rankInputClass =
  "w-full min-w-0 max-w-full rounded-md border border-border bg-background px-1 py-1 text-[11px] outline-none focus:border-primary sm:text-xs";

const mealSelectClass =
  "w-full min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm font-semibold tabular-nums outline-none focus:border-primary sm:text-base";

export function MealRosterGuarantyTab({
  selectedUnitId,
  yearMonth,
  setYearMonth,
  canAccess,
  canPickUnits,
  workingUnitId,
  sortedUnits,
  manualUnitId,
  setManualUnitId,
  user,
}) {
  const { confirm } = useConfirm();
  const [drafts, setDrafts] = useState({});
  const fileRef = useRef(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const skipQuery = !selectedUnitId || !yearMonth || !canAccess;
  const skipMeta = !selectedUnitId || !canAccess;
  const { data: meta } = useGetMealRosterMetaQuery(
    { unitId: selectedUnitId, yearMonth },
    { skip: skipMeta || !yearMonth },
  );
  const metaRates = meta?.rates ?? [];
  const metaUnitOptions = meta?.unitOptions ?? [];
  const needsMealRateSelection = Boolean(meta?.needsMealRateSelection);
  const needsStandardRatesForGuaranty = metaRates.length === 0 && !needsMealRateSelection;
  const rateById = useMemo(() => {
    const m = new Map();
    for (const rate of metaRates) {
      m.set(String(rate.id), rate);
    }
    return m;
  }, [metaRates]);

  const { data: rows = [], isLoading, isFetching, refetch } = useGetMealRosterQuery(
    { unitId: selectedUnitId, yearMonth },
    { skip: skipQuery },
  );

  useEffect(() => {
    const next = {};
    for (const r of rows) {
      next[r.id] = {
        fullName: r.fullName,
        rank: r.rank ?? "",
        mealAllowanceRateId:
          r.mealAllowanceRateId != null ? String(r.mealAllowanceRateId) : "",
        unitDisplay: r.unitDisplay,
      };
    }
    setDrafts(next);
  }, [rows]);

  const [createEntry, { isLoading: creating }] = useCreateMealRosterEntryMutation();
  const [patchEntry, { isLoading: patching }] = usePatchMealRosterEntryMutation();
  const [deleteEntry, { isLoading: deleting }] = useDeleteMealRosterEntryMutation();
  const [importRoster, { isLoading: importing }] = useImportMealRosterMutation();
  const [copyPrevious, { isLoading: copying }] = useCopyMealRosterPreviousMutation();

  const busy = creating || patching || deleting || importing || copying || downloadingTemplate;

  const handleDownloadTemplate = useCallback(async () => {
    if (!selectedUnitId) {
      return;
    }
    setDownloadingTemplate(true);
    try {
      const res = await httpClient.get("/meal-roster/import-template", {
        params: { unitId: selectedUnitId },
        responseType: "blob",
      });
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cham-com-mau-u${selectedUnitId}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      notifySuccess("Đã tải file mẫu");
    } catch (e) {
      let msg = e?.message || "Không tải được mẫu Excel";
      const data = e?.response?.data;
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          const j = JSON.parse(text);
          if (j?.message) {
            msg = j.message;
          }
        } catch {
          /* ignore */
        }
      } else if (data?.message) {
        msg = data.message;
      } else if (typeof data === "string" && data.trim()) {
        msg = data;
      }
      notifyError(msg);
    } finally {
      setDownloadingTemplate(false);
    }
  }, [selectedUnitId]);

  const updateDraft = useCallback((id, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }, []);

  const handleSaveRow = useCallback(
    async (id) => {
      const d = drafts[id];
      if (!d) {
        return;
      }
      const rateId = Number(d.mealAllowanceRateId);
      if (!d.fullName?.trim()) {
        notifyError("Họ và tên không được để trống");
        return;
      }
      if (!Number.isFinite(rateId) || rateId <= 0) {
        notifyError("Chọn mức trong tập đã cấu hình cho đơn vị");
        return;
      }
      if (!d.unitDisplay?.trim()) {
        notifyError("Đơn vị không được để trống");
        return;
      }
      try {
        await patchEntry({
          id,
          unitId: selectedUnitId,
          yearMonth,
          body: {
            fullName: d.fullName.trim(),
            rank: d.rank.trim(),
            mealAllowanceRateId: rateId,
            unitDisplay: d.unitDisplay.trim(),
          },
        }).unwrap();
        notifySuccess("Đã lưu dòng");
      } catch (e) {
        notifyError(e?.data?.message || "Không lưu được");
      }
    },
    [drafts, patchEntry, selectedUnitId, yearMonth],
  );

  const handleDeleteRow = useCallback(
    async (id) => {
      const ok = await confirm({
        title: "Xóa dòng?",
        description: "Thao tác không hoàn tác.",
        confirmLabel: "Xóa",
        destructive: true,
      });
      if (!ok) {
        return;
      }
      try {
        await deleteEntry({ id, unitId: selectedUnitId, yearMonth }).unwrap();
        notifySuccess("Đã xóa");
      } catch (e) {
        notifyError(e?.data?.message || "Không xóa được");
      }
    },
    [confirm, deleteEntry, selectedUnitId, yearMonth],
  );

  const [newRow, setNewRow] = useState({
    fullName: "",
    rank: "",
    mealAllowanceRateId: "",
    unitDisplay: "",
  });

  const handleAddRow = useCallback(async () => {
    if (!selectedUnitId) {
      notifyError("Chưa chọn đơn vị");
      return;
    }
    const rateId = Number(newRow.mealAllowanceRateId);
    if (!newRow.fullName.trim()) {
      notifyError("Nhập họ và tên");
      return;
    }
    if (!Number.isFinite(rateId) || rateId <= 0) {
      notifyError("Chọn đối tượng / mức (trong tập đã chọn)");
      return;
    }
    if (!newRow.unitDisplay.trim()) {
      notifyError("Chọn đơn vị");
      return;
    }
    try {
      await createEntry({
        unitId: selectedUnitId,
        yearMonth,
        fullName: newRow.fullName.trim(),
        rank: newRow.rank.trim(),
        mealAllowanceRateId: rateId,
        unitDisplay: newRow.unitDisplay.trim(),
      }).unwrap();
      setNewRow({ fullName: "", rank: "", mealAllowanceRateId: "", unitDisplay: "" });
      notifySuccess("Đã thêm dòng");
    } catch (e) {
      notifyError(e?.data?.message || "Không thêm được");
    }
  }, [createEntry, newRow, selectedUnitId, yearMonth]);

  const handleImportPick = () => fileRef.current?.click();

  const onImportFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !selectedUnitId) {
        return;
      }
      const ok = await confirm({
        title: "Nhập từ Excel?",
        description:
          "Toàn bộ dòng của tháng đang chọn sẽ bị thay thế. Sheet «ChamCom»: A họ tên, B cấp bậc, C chỉ mức «ăn tiêu chuẩn» (dropdown đúng file mẫu), D đơn vị. Tải mẫu sau khi cấu hình mức cho đơn vị.",
        confirmLabel: "Nhập",
      });
      if (!ok) {
        return;
      }
      try {
        await importRoster({ file, unitId: selectedUnitId, yearMonth }).unwrap();
        notifySuccess("Đã nhập Excel");
        void refetch();
      } catch (err) {
        notifyError(err?.data?.message || err?.error || "Nhập file thất bại");
      }
    },
    [confirm, importRoster, refetch, selectedUnitId, yearMonth],
  );

  const handleCopyPrevious = useCallback(async () => {
    if (!selectedUnitId) {
      return;
    }
    const prev = prevYearMonthLabel(yearMonth);
    const ok = await confirm({
      title: "Sao chép từ tháng trước?",
      description: `Dữ liệu tháng ${yearMonth} sẽ bị thay bằng bản sao từ tháng ${prev} (nếu có).`,
      confirmLabel: "Sao chép",
    });
    if (!ok) {
      return;
    }
    try {
      await copyPrevious({ unitId: selectedUnitId, yearMonth }).unwrap();
      notifySuccess("Đã sao chép");
      void refetch();
    } catch (err) {
      notifyError(err?.data?.message || err?.error || "Không sao chép được");
    }
  }, [confirm, copyPrevious, refetch, selectedUnitId, yearMonth]);

  const unitLabel =
    sortedUnits.find((u) => Number(u.id) === Number(selectedUnitId))?.name ??
    user?.unit?.name ??
    (selectedUnitId ? `#${selectedUnitId}` : "—");

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        {canPickUnits ? (
          <label
            className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground"
            htmlFor="meal-guaranty-unitId"
          >
            Đơn vị
            <select
              id="meal-guaranty-unitId"
              name="mealGuarantyUnitId"
              className={cn(inputClass, "max-w-md")}
              value={selectedUnitId ?? ""}
              onChange={(e) => setManualUnitId(Number(e.target.value))}
            >
              {sortedUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <span className="text-[11px] font-normal text-muted-foreground">
              {workingUnitId != null
                ? "«Đơn vị đang xem» đặt mặc định; có thể đổi trong danh sách."
                : "Chọn đơn vị trong phạm vi được phép."}
            </span>
          </label>
        ) : (
          <div className="text-sm text-muted-foreground">
            Đơn vị: <span className="font-medium text-foreground">{unitLabel}</span>
          </div>
        )}
        <label
          className="flex min-w-[10rem] flex-col gap-1 text-xs font-medium text-muted-foreground"
          htmlFor="meal-guaranty-yearMonth"
        >
          Tháng
          <input
            id="meal-guaranty-yearMonth"
            name="mealGuarantyYearMonth"
            type="month"
            className={inputClass}
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy || !selectedUnitId}
            onClick={handleCopyPrevious}
            className="gap-2"
          >
            {copying ? <Loader2 className="size-4 animate-spin" /> : <ClipboardPaste className="size-4" />}
            Tháng trước → tháng này
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || !selectedUnitId}
            onClick={() => void handleDownloadTemplate()}
            className="gap-2"
          >
            {downloadingTemplate ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Tải mẫu Excel
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy || !selectedUnitId}
            onClick={handleImportPick}
            className="gap-2"
          >
            {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Nhập Excel
          </Button>
          <input
            ref={fileRef}
            id="meal-guaranty-import-file"
            name="mealGuarantyImportFile"
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={onImportFile}
          />
        </div>
      </div>

      {!selectedUnitId ? (
        <p className="text-sm text-amber-700 dark:text-amber-200">
          Tài khoản chưa gắn đơn vị hoặc chưa có quyền xem danh sách đơn vị — không thể tải danh sách.
        </p>
      ) : null}
      {selectedUnitId && canAccess && needsMealRateSelection ? (
        <p className="text-sm text-amber-700 dark:text-amber-200">
          Chưa chọn mức tiền ăn áp dụng cho đơn vị — chuyển sang tab «Sổ chấm cơm» và bấm «Chọn mức tiền ăn cho đơn vị», sau đó
          quay lại tab này.
        </p>
      ) : null}
      {selectedUnitId && canAccess && needsStandardRatesForGuaranty ? (
        <p className="text-sm text-amber-700 dark:text-amber-200">
          Trong tập đã chọn chưa có mức «ăn tiêu chuẩn» (chỉ có «ăn thêm») — tab này và file Excel cần ít nhất một mức
          tiêu chuẩn trong «Chọn mức tiền ăn cho đơn vị».
        </p>
      ) : null}
      {selectedUnitId && canAccess && metaUnitOptions.length === 0 ? (
        <p className="text-sm text-amber-700 dark:text-amber-200">
          Đơn vị này chưa có danh sách đơn vị trực thuộc (AssignedUnit) — hãy cấu hình hoặc dùng tên đơn vị mặc định.
        </p>
      ) : null}

      <div className="min-w-0 overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[720px] table-auto border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="w-[min(14rem,30vw)] px-3 py-2.5 text-left text-xs font-semibold text-foreground">
                Họ và tên
              </th>
              <th className="w-14 px-2 py-2.5 text-left text-xs font-semibold text-foreground">Cấp bậc</th>
              <th className="min-w-[11rem] px-2 py-2.5 text-left text-xs font-semibold text-foreground">Mức (đ)</th>
              <th className="min-w-[10rem] px-3 py-2.5 text-left text-xs font-semibold text-foreground">Đơn vị</th>
              <th className="w-28 px-2 py-2.5 text-right text-xs font-semibold text-foreground">Thao tác</th>
            </tr>
          </thead>
          <tbody className="[&_tr]:border-b [&_tr]:border-border/60">
            {isLoading || isFetching ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-6 animate-spin opacity-60" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  Chưa có dữ liệu tháng này. Thêm dòng, nhập Excel hoặc sao chép từ tháng trước.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const d = drafts[r.id] ?? {
                  fullName: r.fullName,
                  rank: r.rank ?? "",
                  mealAllowanceRateId:
                    r.mealAllowanceRateId != null ? String(r.mealAllowanceRateId) : "",
                  unitDisplay: r.unitDisplay,
                };
                const selectedRate = d.mealAllowanceRateId ? rateById.get(d.mealAllowanceRateId) : null;
                return (
                  <tr key={r.id}>
                    <td className="align-top px-3 py-2">
                      <input
                        id={`meal-guaranty-row-${r.id}-fullName`}
                        name={`mealGuarantyEntry_${r.id}_fullName`}
                        className={inputClass}
                        value={d.fullName}
                        onChange={(e) => updateDraft(r.id, "fullName", e.target.value)}
                        disabled={!canAccess || busy}
                      />
                    </td>
                    <td className="align-top px-2 py-2">
                      <input
                        id={`meal-guaranty-row-${r.id}-rank`}
                        name={`mealGuarantyEntry_${r.id}_rank`}
                        className={rankInputClass}
                        value={d.rank}
                        onChange={(e) => updateDraft(r.id, "rank", e.target.value)}
                        disabled={!canAccess || busy}
                      />
                    </td>
                    <td className="align-top px-2 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <select
                          id={`meal-guaranty-row-${r.id}-rate`}
                          name={`mealGuarantyEntry_${r.id}_mealAllowanceRateId`}
                          className={mealSelectClass}
                          value={d.mealAllowanceRateId}
                          onChange={(e) => updateDraft(r.id, "mealAllowanceRateId", e.target.value)}
                          disabled={!canAccess || busy || metaRates.length === 0}
                        >
                          <option value="">—</option>
                          {metaRates.map((rate) => {
                            const pa = periodAmountsForRate(rate);
                            return (
                              <option
                                key={rate.id}
                                value={String(rate.id)}
                                title={`S ${formatMealAmountOnly(pa.sang)} · T ${formatMealAmountOnly(pa.trua)} · C ${formatMealAmountOnly(pa.chieu)}`}
                              >
                                {formatMealAmountOnly(rate.mucTienAn)}
                              </option>
                            );
                          })}
                        </select>
                        <Tooltip
                          variant="detail"
                          side="left"
                          content={<MealRateDetailTooltipContent rate={selectedRate} />}
                        >
                          <button
                            type="button"
                            className={cn(
                              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/90 bg-card text-muted-foreground shadow-sm transition hover:border-primary/30 hover:bg-muted hover:text-foreground",
                              selectedRate && "border-primary/25 text-primary",
                            )}
                            aria-label="Xem chi tiết mức tiền ăn"
                          >
                            <Eye className="size-4 shrink-0 stroke-[1.75]" aria-hidden />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                    <td className="align-top px-3 py-2">
                      <select
                        id={`meal-guaranty-row-${r.id}-unitDisplay`}
                        name={`mealGuarantyEntry_${r.id}_unitDisplay`}
                        className={inputClass}
                        value={d.unitDisplay}
                        onChange={(e) => updateDraft(r.id, "unitDisplay", e.target.value)}
                        disabled={!canAccess || busy || metaUnitOptions.length === 0}
                      >
                        <option value="">Chọn đơn vị…</option>
                        {metaUnitOptions.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="align-top px-2 py-2 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          disabled={!canAccess || busy}
                          onClick={() => void handleSaveRow(r.id)}
                        >
                          Lưu
                        </Button>
                        <IconButton
                          type="button"
                          label="Xóa dòng"
                          disabled={!canAccess || busy}
                          onClick={() => void handleDeleteRow(r.id)}
                        >
                          <Trash2 className="size-4" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-3 sm:p-4">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Thêm dòng mới</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
          <input
            id="meal-guaranty-new-fullName"
            name="mealGuarantyNewFullName"
            className={cn(inputClass, "lg:col-span-3")}
            placeholder="Họ và tên"
            autoComplete="name"
            value={newRow.fullName}
            onChange={(e) => setNewRow((p) => ({ ...p, fullName: e.target.value }))}
            disabled={!canAccess || busy || !selectedUnitId}
          />
          <input
            id="meal-guaranty-new-rank"
            name="mealGuarantyNewRank"
            className={cn(rankInputClass, "lg:col-span-1")}
            placeholder="Cấp bậc"
            title="Cấp bậc"
            value={newRow.rank}
            onChange={(e) => setNewRow((p) => ({ ...p, rank: e.target.value }))}
            disabled={!canAccess || busy || !selectedUnitId}
          />
          <select
            id="meal-guaranty-new-rateId"
            name="mealGuarantyNewMealAllowanceRateId"
            className={cn(inputClass, "lg:col-span-4")}
            value={newRow.mealAllowanceRateId}
            onChange={(e) => setNewRow((p) => ({ ...p, mealAllowanceRateId: e.target.value }))}
            disabled={!canAccess || busy || !selectedUnitId || metaRates.length === 0}
          >
            <option value="">Chọn mức ăn tiêu chuẩn (tập đã chọn)…</option>
            {metaRates.map((rate) => (
              <option key={rate.id} value={String(rate.id)} title={rate.label}>
                {rate.label}
              </option>
            ))}
          </select>
          <select
            id="meal-guaranty-new-unitDisplay"
            name="mealGuarantyNewUnitDisplay"
            className={cn(inputClass, "lg:col-span-2")}
            value={newRow.unitDisplay}
            onChange={(e) => setNewRow((p) => ({ ...p, unitDisplay: e.target.value }))}
            disabled={!canAccess || busy || !selectedUnitId || metaUnitOptions.length === 0}
          >
            <option value="">Đơn vị…</option>
            {metaUnitOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            className="lg:col-span-2"
            disabled={!canAccess || busy || !selectedUnitId}
            onClick={() => void handleAddRow()}
          >
            <Plus className="mr-1 size-4" />
            Thêm
          </Button>
        </div>
      </div>
    </div>
  );
}
