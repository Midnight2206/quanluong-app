"use client";

import { Loader2, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  useChungTuTemplateFillMappingQuery,
  usePutChungTuTemplateFillMappingMutation,
} from "@/features/chung-tu-quyet-toan/api/chungTuDocumentApi";
import {
  CHUNG_TU_DETAIL_FIELD_CATALOG,
  detailFieldLabel,
} from "@/pages/chungTuQuyetToan/chungTuDetailFieldCatalog";
import { excelColumnLetter, mergeColumnMappingsWithSuggestedSlots } from "@/pages/chungTuQuyetToan/chungTuFormat";

const DEFAULT_SHEET_PRINT = {
  rowHeightPt: 18,
};

function buildFieldOptions(fieldRegistry) {
  const seen = new Set();
  const options = [];

  const push = (fieldKey, label, group) => {
    if (!fieldKey || seen.has(fieldKey)) return;
    seen.add(fieldKey);
    options.push({ fieldKey, label: label || fieldKey, group });
  };

  for (const f of fieldRegistry?.derivedFields ?? []) {
    push(f.fieldKey, f.label, "Tự động từ dữ liệu");
  }
  for (const f of fieldRegistry?.detailFields ?? CHUNG_TU_DETAIL_FIELD_CATALOG) {
    push(f.fieldKey, f.label, "Cột bảng chi tiết");
  }
  for (const t of fieldRegistry?.dbTables ?? []) {
    for (const c of t.columns ?? []) {
      push(c.fieldKeyHint, c.column, "Cột bảng chi tiết (legacy)");
    }
  }

  return options;
}

function emptyFillRules() {
  return {
    version: 2,
    sheets: {
      namedRanges: [],
      detailTable: null,
    },
    print: {
      sheets: { ...DEFAULT_SHEET_PRINT },
    },
  };
}

function resolveColumnMappings(detailTable, sheetHeaders, suggestedColumnSlots) {
  const saved = Array.isArray(detailTable?.columnMappings) ? detailTable.columnMappings : [];

  if (Array.isArray(suggestedColumnSlots) && suggestedColumnSlots.length) {
    return mergeColumnMappingsWithSuggestedSlots(saved, suggestedColumnSlots);
  }

  const mapSaved = (items) =>
    items.map((item) => ({
      col: Number(item.col),
      label: String(item.label ?? "").trim() || detailFieldLabel(item.fieldKey),
      fieldKey: String(item.fieldKey ?? "").trim(),
    }));

  if (saved.length) {
    return mapSaved(saved);
  }

  const headerRows = sheetHeaders?.headerRows ?? [];
  if (!headerRows.length) {
    const legacy = Array.isArray(detailTable?.columns) ? detailTable.columns : [];
    const startCol = Number(detailTable?.startCol ?? 0);
    return legacy.map((fieldKey, index) => ({
      col: startCol + index,
      label: detailFieldLabel(fieldKey),
      fieldKey: String(fieldKey ?? "").trim(),
    }));
  }

  let best = headerRows[0];
  let bestScore = -1;
  for (const row of headerRows) {
    const score = row.cells?.filter((cell) => cell.fieldKey).length ?? 0;
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }

  return (best?.cells ?? []).map((cell) => ({
    col: Number(cell.col),
    label: String(cell.label ?? "").trim(),
    fieldKey: String(cell.fieldKey ?? "").trim(),
  }));
}

/**
 * @param {{ categoryKey: string, driveFileId: string, canWrite?: boolean }} props
 */
export function ChungTuTemplateMappingPanel({ categoryKey, driveFileId, canWrite = false }) {
  const { data, isLoading, isError, error, refetch } = useChungTuTemplateFillMappingQuery(
    { categoryKey, driveFileId },
    { skip: !driveFileId },
  );

  const [fillRules, setFillRules] = useState(emptyFillRules);
  const [saveError, setSaveError] = useState(null);
  const [saveOk, setSaveOk] = useState(false);

  const [putMapping, { isLoading: saving }] = usePutChungTuTemplateFillMappingMutation();

  useEffect(() => {
    if (!data?.fillRules) return;
    setFillRules({
      ...data.fillRules,
      print: {
        ...data.fillRules.print,
        sheets: {
          ...DEFAULT_SHEET_PRINT,
          ...(data.fillRules.print?.sheets ?? {}),
        },
      },
    });
    setSaveOk(false);
  }, [data?.fillRules, driveFileId]);

  const fieldOptions = useMemo(() => buildFieldOptions(data?.fieldRegistry), [data?.fieldRegistry]);
  const detailFieldOptions = useMemo(
    () => fieldOptions.filter((opt) => opt.group.includes("Cột bảng")),
    [fieldOptions],
  );

  const detailTable = fillRules?.sheets?.detailTable;
  const columnMappings = useMemo(
    () =>
      resolveColumnMappings(
        detailTable,
        data?.sheetHeaders,
        data?.suggestedColumnSlots,
      ),
    [detailTable, data?.sheetHeaders, data?.suggestedColumnSlots],
  );

  const updateDetailTable = (patch) => {
    setFillRules((prev) => {
      const next = { ...prev, sheets: { ...prev.sheets } };
      next.sheets.detailTable = { ...(next.sheets.detailTable ?? {}), ...patch };
      return next;
    });
    setSaveOk(false);
  };

  const updateColumnMapping = (index, patch) => {
    const next = columnMappings.map((item, i) => (i === index ? { ...item, ...patch } : item));
    updateDetailTable({
      columnMappings: next,
      columns: next.map((item) => item.fieldKey).filter(Boolean),
      amountFieldKey:
        next.find((item) => item.fieldKey === "thanhTien")?.fieldKey ||
        detailTable?.amountFieldKey ||
        "thanhTien",
      labelFieldKey:
        next.find((item) => item.fieldKey === "tenHang")?.fieldKey ||
        detailTable?.labelFieldKey ||
        "tenHang",
    });
  };

  const handleSave = async () => {
    setSaveError(null);
    setSaveOk(false);
    try {
      const mappings = columnMappings.filter((item) => item.fieldKey);
      await putMapping({
        categoryKey,
        driveFileId,
        fillRules: {
          version: 2,
          sheets: {
            namedRanges: [],
            detailTable: mappings.length
              ? {
                  sheetName: detailTable?.sheetName || data?.sheetHeaders?.sheetTitle || "Sheet1",
                  headerRow:
                    detailTable?.headerRow ??
                    data?.sheetHeaders?.headerRows?.[0]?.rowNumber ??
                    null,
                  startRow: Number(detailTable?.startRow ?? 8),
                  startCol: Number(
                    detailTable?.startCol ??
                      (mappings.length ? Math.min(...mappings.map((m) => m.col)) : 0),
                  ),
                  templateRow: Number(detailTable?.templateRow ?? detailTable?.startRow ?? 8),
                  totalTemplateRow: Number(
                    detailTable?.totalTemplateRow ?? Number(detailTable?.startRow ?? 8) + 1,
                  ),
                  columnMappings: mappings,
                  columns: mappings.map((item) => item.fieldKey),
                  rowHeightPt: DEFAULT_SHEET_PRINT.rowHeightPt,
                  amountFieldKey: detailTable?.amountFieldKey || "thanhTien",
                  labelFieldKey: detailTable?.labelFieldKey || "tenHang",
                  totalLabel: detailTable?.totalLabel || "Tổng cộng",
                }
              : null,
          },
          print: {
            sheets: {
              ...DEFAULT_SHEET_PRINT,
              ...(fillRules.print?.sheets ?? {}),
            },
          },
        },
      });
      setSaveOk(true);
      refetch();
    } catch (e) {
      setSaveError(e?.data?.message || e?.message || "Không lưu được map dữ liệu.");
    }
  };

  if (!driveFileId) return null;

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Đang tải map mẫu…
      </p>
    );
  }

  if (isError) {
    return (
      <p className="text-xs text-destructive">
        {error?.data?.message || error?.message || "Không tải được cấu hình map."}
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
            Map dữ liệu → ô mẫu
          </h4>
          <p className="text-[10px] text-muted-foreground">
            {data?.hasSavedConfig ? "Đã lưu cấu hình" : "Gợi ý tự động — chưa lưu"}
            {data?.driveFileName ? ` · ${data.driveFileName}` : ""}
          </p>
        </div>
        {canWrite ? (
          <Button type="button" size="sm" disabled={saving} onClick={handleSave}>
            {saving ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1 h-3.5 w-3.5" />
            )}
            Lưu map
          </Button>
        ) : null}
      </div>

      <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5 text-[10px] leading-relaxed text-muted-foreground">
        <p className="font-semibold text-foreground">Ghi bảng chi tiết</p>
        <p className="mt-1">
          Dòng tổng trên mẫu (<strong>dòng tổng mẫu</strong>) được giữ nguyên định dạng — app chỉ
          ghi <strong>ô thành tiền</strong>. Khi có nhiều dòng LTTP, app chèn thêm dòng dữ liệu
          phía trên dòng tổng mẫu.
        </p>
        <p className="mt-1">
          Chọn logic fill cho từng cột (A, B, C, …). Với mẫu có tiêu đề bị merge, app vẫn hiển
          thị đủ các cột cố định theo loại chứng từ.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-2.5">
        <h5 className="text-[10px] font-semibold uppercase text-foreground">
          Cột bảng chi tiết
        </h5>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Tên sheet</span>
            <input
              type="text"
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
              value={detailTable?.sheetName ?? data?.sheetHeaders?.sheetTitle ?? "Sheet1"}
              disabled={!canWrite}
              onChange={(e) => updateDetailTable({ sheetName: e.target.value })}
            />
          </label>
          <label className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Dòng dữ liệu đầu (0-based)</span>
            <input
              type="number"
              min={0}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
              value={detailTable?.startRow ?? 8}
              disabled={!canWrite}
              onChange={(e) => updateDetailTable({ startRow: Number(e.target.value) })}
            />
          </label>
          <label className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Dòng mẫu định dạng (0-based)</span>
            <input
              type="number"
              min={0}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
              value={detailTable?.templateRow ?? detailTable?.startRow ?? 8}
              disabled={!canWrite}
              onChange={(e) => updateDetailTable({ templateRow: Number(e.target.value) })}
            />
          </label>
          <label className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Dòng tổng mẫu (0-based)</span>
            <input
              type="number"
              min={0}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
              value={
                detailTable?.totalTemplateRow ?? Number(detailTable?.startRow ?? 8) + 1
              }
              disabled={!canWrite}
              onChange={(e) => updateDetailTable({ totalTemplateRow: Number(e.target.value) })}
            />
          </label>
          <label className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Dòng tiêu đề cột (0-based)</span>
            <input
              type="number"
              min={0}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
              value={
                detailTable?.headerRow ??
                data?.sheetHeaders?.headerRows?.[0]?.rowNumber ??
                ""
              }
              disabled={!canWrite}
              onChange={(e) => updateDetailTable({ headerRow: Number(e.target.value) })}
            />
          </label>
        </div>

        {columnMappings.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">
            Không đọc được tiêu đề cột từ mẫu — kiểm tra dòng header trên Google Sheets.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/80">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[10px] uppercase text-muted-foreground">
                  <th className="px-2 py-1.5 font-semibold">Cột / tiêu đề</th>
                  <th className="px-2 py-1.5 font-semibold">Vị trí</th>
                  <th className="px-2 py-1.5 font-semibold">Logic fill dữ liệu</th>
                </tr>
              </thead>
              <tbody>
                {columnMappings.map((mapping, index) => (
                  <tr key={`${mapping.col}-${mapping.label}`} className="border-b border-border/50">
                    <td className="px-2 py-1.5 font-medium">
                      {(mapping.fieldKey ? detailFieldLabel(mapping.fieldKey) : null) ||
                        mapping.label ||
                        "—"}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
                      {excelColumnLetter(mapping.col)} ({mapping.col})
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        className="w-full min-w-[180px] rounded border border-border bg-background px-1.5 py-1 text-xs"
                        value={mapping.fieldKey ?? ""}
                        disabled={!canWrite}
                        onChange={(e) =>
                          updateColumnMapping(index, { fieldKey: e.target.value })
                        }
                      >
                        <option value="">— Không fill —</option>
                        {detailFieldOptions.map((opt) => (
                          <option key={opt.fieldKey} value={opt.fieldKey}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {saveError ? <p className="text-xs text-destructive">{saveError}</p> : null}
      {saveOk ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          Đã lưu map — tạo/đồng bộ chứng từ sẽ dùng cấu hình này.
        </p>
      ) : null}
    </div>
  );
}
