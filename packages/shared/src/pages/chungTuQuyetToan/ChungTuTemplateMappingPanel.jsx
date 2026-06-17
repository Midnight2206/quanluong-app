"use client";

import { Loader2, Save } from "lucide-react";
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

function buildFieldOptions(fieldRegistry) {
  const seen = new Set();
  const options = [];

  const push = (fieldKey, label, group) => {
    if (!fieldKey || seen.has(fieldKey)) return;
    seen.add(fieldKey);
    options.push({ fieldKey, label: label || fieldKey, group });
  };

  for (const f of fieldRegistry?.formFields ?? []) {
    push(f.fieldKey, f.label, "Thông tin in / form");
  }
  for (const f of fieldRegistry?.derivedFields ?? []) {
    push(f.fieldKey, f.label, "Tự tính / ngày tháng");
  }
  for (const t of fieldRegistry?.dbTables ?? []) {
    for (const c of t.columns ?? []) {
      push(c.fieldKeyHint, c.column, "Cột bảng chi tiết");
    }
  }

  return options.sort((a, b) => a.label.localeCompare(b.label, "vi"));
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
  };
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
    setFillRules(data.fillRules);
    setSaveOk(false);
  }, [data?.fillRules, driveFileId]);

  const fieldOptions = useMemo(() => buildFieldOptions(data?.fieldRegistry), [data?.fieldRegistry]);

  const namedRanges = fillRules?.sheets?.namedRanges ?? [];
  const detailTable = fillRules?.sheets?.detailTable;
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

  const toggleDetailColumn = (colKey) => {
    const cols = [...(detailTable?.columns ?? [])];
    const idx = cols.indexOf(colKey);
    if (idx >= 0) {
      cols.splice(idx, 1);
    } else {
      cols.push(colKey);
    }
    updateDetailTable({ columns: cols });
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
                  repeatHeaderEveryRows: Number(detailTable.repeatHeaderEveryRows ?? 0),
                  repeatHeaderLabels: Array.isArray(detailTable.repeatHeaderLabels)
                    ? detailTable.repeatHeaderLabels
                    : [],
                  pageRowsFirst: Number(detailTable.pageRowsFirst ?? 0),
                  pageRowsNext: Number(detailTable.pageRowsNext ?? 0),
                  amountFieldKey: detailTable.amountFieldKey || "thanhTien",
                  labelFieldKey: detailTable.labelFieldKey || "tenHang",
                  carryInLabel: detailTable.carryInLabel || "Mang sang",
                  carryOutLabel: detailTable.carryOutLabel || "Cộng sang trang",
                }
              : null,
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

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-[10px] leading-relaxed text-muted-foreground">
        <p className="font-semibold text-foreground">Chữ ký (4 ô lưới ký tự)</p>
        <p className="mt-1">
          Trên Sheets: vẽ hàng ô vuông (viền từng ô) cho tên người ký → chọn <strong>cả hàng</strong> →
          Dữ liệu → Vùng đặt tên, ví dụ{" "}
          <span className="font-mono">grid_nguoiMua</span>, <span className="font-mono">grid_phuTrachBoPhan</span>
          … Trong bảng map bên dưới chọn kiểu <strong>Lưới ký tự</strong> và field tương ứng. App sẽ tách từng
          chữ cái vào từng ô.
        </p>
      </div>

      {namedRanges.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Mẫu chưa có Named range trên Google Sheets. Trên Sheets: chọn ô → Dữ liệu → Named ranges,
          đặt tên trùng fieldKey (vd. <span className="font-mono">donViSo</span>) hoặc map thủ công
          sau khi tạo.
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
                      <option value="static">Cố định</option>
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
          <label className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Lặp tiêu đề sau N dòng</span>
            <input
              type="number"
              min={0}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
              value={detailTable?.repeatHeaderEveryRows ?? 0}
              disabled={!canWrite}
              onChange={(e) => updateDetailTable({ repeatHeaderEveryRows: Number(e.target.value) })}
            />
          </label>
          <label className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Trang đầu: số dòng dữ liệu</span>
            <input
              type="number"
              min={0}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
              value={detailTable?.pageRowsFirst ?? 0}
              disabled={!canWrite}
              onChange={(e) => updateDetailTable({ pageRowsFirst: Number(e.target.value) })}
            />
          </label>
          <label className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Trang sau: số dòng dữ liệu</span>
            <input
              type="number"
              min={0}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
              value={detailTable?.pageRowsNext ?? 0}
              disabled={!canWrite}
              onChange={(e) => updateDetailTable({ pageRowsNext: Number(e.target.value) })}
            />
          </label>
          <label className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Cột cộng lũy kế</span>
            <select
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
              value={detailTable?.amountFieldKey ?? "thanhTien"}
              disabled={!canWrite}
              onChange={(e) => updateDetailTable({ amountFieldKey: e.target.value })}
            >
              {DETAIL_COLUMN_OPTIONS.map((col) => (
                <option key={col.key} value={col.key}>
                  {col.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Cột ghi nhãn carry</span>
            <select
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
              value={detailTable?.labelFieldKey ?? "tenHang"}
              disabled={!canWrite}
              onChange={(e) => updateDetailTable({ labelFieldKey: e.target.value })}
            >
              {DETAIL_COLUMN_OPTIONS.map((col) => (
                <option key={col.key} value={col.key}>
                  {col.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Nhãn Mang sang</span>
            <input
              type="text"
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
              value={detailTable?.carryInLabel ?? "Mang sang"}
              disabled={!canWrite}
              onChange={(e) => updateDetailTable({ carryInLabel: e.target.value })}
            />
          </label>
          <label className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Nhãn Cộng sang trang</span>
            <input
              type="text"
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
              value={detailTable?.carryOutLabel ?? "Cộng sang trang"}
              disabled={!canWrite}
              onChange={(e) => updateDetailTable({ carryOutLabel: e.target.value })}
            />
          </label>
        </div>
        <label className="block space-y-0.5">
          <span className="text-[10px] text-muted-foreground">
            Tiêu đề lặp (phân cách bằng dấu |, để trống sẽ dùng fieldKey)
          </span>
          <input
            type="text"
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
            value={(detailTable?.repeatHeaderLabels ?? []).join(" | ")}
            disabled={!canWrite}
            onChange={(e) =>
              updateDetailTable({
                repeatHeaderLabels: e.target.value
                  .split("|")
                  .map((part) => part.trim()),
              })
            }
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {DETAIL_COLUMN_OPTIONS.map((col) => {
            const active = (detailTable?.columns ?? []).includes(col.key);
            return (
              <button
                key={col.key}
                type="button"
                disabled={!canWrite}
                className={`rounded border px-2 py-0.5 text-[10px] transition ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
                onClick={() => toggleDetailColumn(col.key)}
              >
                {col.label}
              </button>
            );
          })}
        </div>
        {(detailTable?.columns ?? []).length > 0 ? (
          <p className="text-[10px] text-muted-foreground">
            Thứ tự cột: {(detailTable?.columns ?? []).join(" → ")}
          </p>
        ) : null}
      </div>

      {saveError ? <p className="text-xs text-destructive">{saveError}</p> : null}
      {saveOk ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">Đã lưu map — tạo/đồng bộ chứng từ sẽ dùng cấu hình này.</p>
      ) : null}
    </div>
  );
}
