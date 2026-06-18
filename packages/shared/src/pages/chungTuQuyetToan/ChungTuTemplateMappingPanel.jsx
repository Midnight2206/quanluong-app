"use client";

import { ChevronDown, ChevronUp, Loader2, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  useChungTuTemplateFillMappingQuery,
  usePutChungTuTemplateFillMappingMutation,
} from "@/features/chung-tu-quyet-toan/api/chungTuDocumentApi";

const DETAIL_COLUMN_OPTIONS = [
  { key: "stt", label: "STT" },
  { key: "tenHang", label: "Tên hàng" },
  { key: "maSo", label: "Mã số" },
  { key: "dvt", label: "ĐVT" },
  { key: "nguoiBan", label: "Người bán" },
  { key: "soLuong", label: "Số lượng" },
  { key: "donGia", label: "Đơn giá" },
  { key: "thanhTien", label: "Thành tiền" },
  { key: "ghiChu", label: "Ghi chú" },
];

const DETAIL_COLUMN_LABELS = Object.fromEntries(
  DETAIL_COLUMN_OPTIONS.map((col) => [col.key, col.label]),
);

const DEFAULT_SHEET_PRINT = {
  rowsPerPage: 40,
  rowHeightPt: 18,
  enabled: true,
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
  for (const t of fieldRegistry?.dbTables ?? []) {
    for (const c of t.columns ?? []) {
      push(c.fieldKeyHint, c.column, "Cột bảng chi tiết");
    }
  }

  return options;
}

function namedRangeColCount(grid) {
  if (!grid) return 1;
  const start = Number(grid.startColumnIndex ?? 0);
  const end = Number(grid.endColumnIndex ?? start + 1);
  return Math.max(1, end - start);
}

function ruleSelectValue(rule) {
  if (rule === "static") return "static";
  if (rule === "charGrid") return "charGrid";
  return "field";
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

function columnLabel(key) {
  return DETAIL_COLUMN_LABELS[key] ?? key;
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

  const namedRanges = fillRules?.sheets?.namedRanges ?? [];
  const detailTable = fillRules?.sheets?.detailTable;
  const selectedColumns = detailTable?.columns ?? [];
  const availableColumns = DETAIL_COLUMN_OPTIONS.filter(
    (col) => !selectedColumns.includes(col.key),
  );

  const namedRangeMetaByName = useMemo(() => {
    const map = new Map();
    for (const item of data?.namedRanges ?? []) {
      if (item?.name) map.set(item.name, item);
    }
    return map;
  }, [data?.namedRanges]);

  const updateNamedRange = (index, patch) => {
    setFillRules((prev) => {
      const next = { ...prev, sheets: { ...prev.sheets } };
      const rows = [...(next.sheets.namedRanges ?? [])];
      rows[index] = { ...rows[index], ...patch };
      next.sheets.namedRanges = rows;
      return next;
    });
    setSaveOk(false);
  };

  const updateDetailTable = (patch) => {
    setFillRules((prev) => {
      const next = { ...prev, sheets: { ...prev.sheets } };
      next.sheets.detailTable = { ...(next.sheets.detailTable ?? {}), ...patch };
      return next;
    });
    setSaveOk(false);
  };

  const addDetailColumn = (colKey) => {
    if (!colKey || selectedColumns.includes(colKey)) return;
    updateDetailTable({ columns: [...selectedColumns, colKey] });
  };

  const removeDetailColumn = (colKey) => {
    updateDetailTable({ columns: selectedColumns.filter((key) => key !== colKey) });
  };

  const moveDetailColumn = (index, direction) => {
    const next = [...selectedColumns];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    updateDetailTable({ columns: next });
  };

  const handleSave = async () => {
    setSaveError(null);
    setSaveOk(false);
    try {
      await putMapping({
        categoryKey,
        driveFileId,
        fillRules: {
          version: 2,
          sheets: {
            namedRanges: namedRanges.map((nr) => ({
              rangeName: nr.rangeName,
              sheetName: nr.sheetName ?? "",
              rule:
                nr.rule === "static" ? "static" : nr.rule === "charGrid" ? "charGrid" : "field",
              fieldKey: nr.rule === "static" ? "" : (nr.fieldKey ?? ""),
              value: nr.rule === "static" ? (nr.value ?? "") : "",
            })),
            detailTable: detailTable?.columns?.length
              ? {
                  sheetName: detailTable.sheetName || "Sheet1",
                  startRow: Number(detailTable.startRow ?? 8),
                  startCol: Number(detailTable.startCol ?? 0),
                  columns: detailTable.columns,
                  repeatHeaderEveryRows: Number(
                    detailTable.repeatHeaderEveryRows ?? DEFAULT_SHEET_PRINT.rowsPerPage,
                  ),
                  repeatHeaderLabels: Array.isArray(detailTable.repeatHeaderLabels)
                    ? detailTable.repeatHeaderLabels
                    : [],
                  rowsPerPage: DEFAULT_SHEET_PRINT.rowsPerPage,
                  rowHeightPt: DEFAULT_SHEET_PRINT.rowHeightPt,
                  amountFieldKey: detailTable.amountFieldKey || "thanhTien",
                  labelFieldKey: detailTable.labelFieldKey || "tenHang",
                  carryInLabel: detailTable.carryInLabel || "Mang sang",
                  carryOutLabel: detailTable.carryOutLabel || "Cộng sang trang",
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
        Đang tải map Named range…
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
        <p className="font-semibold text-foreground">In / phân trang (chuẩn)</p>
        <p className="mt-1">
          Mỗi trang <strong>40 dòng</strong> (budget in), chiều cao cơ bản <strong>18pt/dòng</strong>.
          Ô wrap thêm 1 dòng → trừ 1 trong 40 và hàng cao thêm 18pt sau khi đồng bộ. App gọi{" "}
          <span className="font-mono">autoResizeDimensions</span> rồi chốt chiều cao theo số dòng wrap.
        </p>
        <p className="mt-1">
          App chỉ fill: <strong>số</strong>, <strong>ngày tháng năm</strong>, <strong>tổng tiền bằng chữ</strong>{" "}
          và bảng chi tiết LTTP. Đơn vị, chữ ký, tiêu đề… để cố định trên template.
        </p>
      </div>

      {namedRanges.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Mẫu chưa có Named range. Trên Sheets: chọn ô → Dữ liệu → Named ranges, đặt tên rồi map field
          bên dưới.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/80">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[10px] uppercase text-muted-foreground">
                <th className="px-2 py-1.5 font-semibold">Named range</th>
                <th className="px-2 py-1.5 font-semibold">Kiểu</th>
                <th className="px-2 py-1.5 font-semibold">Dữ liệu nguồn</th>
              </tr>
            </thead>
            <tbody>
              {namedRanges.map((nr, idx) => {
                const meta = namedRangeMetaByName.get(nr.rangeName);
                const boxCount = namedRangeColCount(meta?.grid);
                return (
                  <tr key={nr.rangeName || idx} className="border-b border-border/50 last:border-0">
                    <td className="px-2 py-1.5">
                      <span className="font-mono text-[11px]">{nr.rangeName}</span>
                      {boxCount > 1 ? (
                        <span className="mt-0.5 block text-[9px] text-muted-foreground">
                          {boxCount} ô ngang
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        className="w-full min-w-[100px] rounded border border-border bg-background px-1.5 py-1 text-xs"
                        value={ruleSelectValue(nr.rule)}
                        disabled={!canWrite}
                        onChange={(e) => {
                          const nextRule = e.target.value;
                          updateNamedRange(idx, {
                            rule: nextRule,
                            fieldKey: nextRule === "static" ? "" : nr.fieldKey,
                            value: nextRule === "field" || nextRule === "charGrid" ? "" : nr.value,
                          });
                        }}
                      >
                        <option value="field">Một ô</option>
                        <option value="charGrid">Lưới ký tự</option>
                        <option value="static">Cố định (template)</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      {nr.rule === "static" ? (
                        <input
                          type="text"
                          className="w-full rounded border border-border bg-background px-1.5 py-1 text-xs"
                          value={nr.value ?? ""}
                          disabled={!canWrite}
                          onChange={(e) => updateNamedRange(idx, { value: e.target.value })}
                          placeholder="Giữ nguyên trên template"
                        />
                      ) : (
                        <select
                          className="w-full min-w-[160px] rounded border border-border bg-background px-1.5 py-1 text-xs"
                          value={nr.fieldKey ?? ""}
                          disabled={!canWrite}
                          onChange={(e) => updateNamedRange(idx, { fieldKey: e.target.value })}
                        >
                          <option value="">— Chọn field —</option>
                          {fieldOptions.map((opt) => (
                            <option key={opt.fieldKey} value={opt.fieldKey}>
                              {opt.label} ({opt.fieldKey})
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-2.5">
        <h5 className="text-[10px] font-semibold uppercase text-foreground">Bảng chi tiết (dòng LTTP)</h5>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Tên sheet</span>
            <input
              type="text"
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
              value={detailTable?.sheetName ?? "Sheet1"}
              disabled={!canWrite}
              onChange={(e) => updateDetailTable({ sheetName: e.target.value })}
            />
          </label>
          <label className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Dòng bắt đầu (0-based)</span>
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
            <span className="text-[10px] text-muted-foreground">Cột bắt đầu (0-based)</span>
            <input
              type="number"
              min={0}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
              value={detailTable?.startCol ?? 0}
              disabled={!canWrite}
              onChange={(e) => updateDetailTable({ startCol: Number(e.target.value) })}
            />
          </label>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground">Thứ tự cột xuất ra sheet</span>
          {selectedColumns.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">Chưa chọn cột nào.</p>
          ) : (
            <ul className="space-y-1">
              {selectedColumns.map((colKey, index) => (
                <li
                  key={colKey}
                  className="flex items-center gap-2 rounded border border-border/70 bg-background/80 px-2 py-1"
                >
                  <span className="min-w-0 flex-1 text-xs font-medium">{columnLabel(colKey)}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{colKey}</span>
                  {canWrite ? (
                    <div className="flex gap-0.5">
                      <button
                        type="button"
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                        disabled={index === 0}
                        onClick={() => moveDetailColumn(index, -1)}
                        aria-label="Lên"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                        disabled={index === selectedColumns.length - 1}
                        onClick={() => moveDetailColumn(index, 1)}
                        aria-label="Xuống"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded px-1.5 text-[10px] text-destructive hover:bg-destructive/10"
                        onClick={() => removeDetailColumn(colKey)}
                      >
                        Bỏ
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {canWrite && availableColumns.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {availableColumns.map((col) => (
              <button
                key={col.key}
                type="button"
                className="rounded border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary hover:text-primary"
                onClick={() => addDetailColumn(col.key)}
              >
                + {col.label}
              </button>
            ))}
          </div>
        ) : null}
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
