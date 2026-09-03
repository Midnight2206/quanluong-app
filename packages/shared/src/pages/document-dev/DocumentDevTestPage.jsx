"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, FileUp, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import {
  fetchDocumentById,
  fetchDocumentDevHealth,
  fetchDocumentTemplates,
  renderStoredDocumentPdfBlob,
  seedDemoDocumentForTemplate,
  uploadDocumentTemplate,
} from "@/features/document-dev/api/documentDevApi";
import { notifyError, notifySuccess } from "@/services/notify";
import { cn } from "@/utils/cn";

const inputClass =
  "w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const DEFAULT_SLOTS = [
  {
    key: "nguoi_lap",
    label: "Người lập",
    col: 0,
    col_span: 1,
    source: "dynamic",
    static_name: "",
    show_date_line: false,
  },
  {
    key: "thu_truong",
    label: "Thủ trưởng đơn vị",
    col: 1,
    col_span: 1,
    source: "dynamic",
    static_name: "",
    show_date_line: false,
  },
];

function emptySlot(col = 0) {
  return {
    key: `slot_${col + 1}`,
    label: "Chức danh",
    col,
    col_span: 1,
    source: "dynamic",
    static_name: "",
    show_date_line: false,
  };
}

export function DocumentDevTestPage() {
  const user = useCurrentUser();
  const isSuperadmin = user?.type?.name === "superadmin";

  const [configured, setConfigured] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [document, setDocument] = useState(null);
  const [uploadName, setUploadName] = useState("bien_ban_test");
  const [uploadVersion, setUploadVersion] = useState("3");
  const [uploadFile, setUploadFile] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const [columns, setColumns] = useState(2);
  const [gapPt, setGapPt] = useState(40);
  const [dateLineGapPt, setDateLineGapPt] = useState(14);
  const [slots, setSlots] = useState(DEFAULT_SLOTS);
  const [signatures, setSignatures] = useState({
    nguoi_lap: "Nguyễn Văn A",
    thu_truong: "Trần Văn B",
  });
  const [signatureDates, setSignatureDates] = useState({
    nguoi_lap: "",
    thu_truong: "",
  });

  const signatureBlock = useMemo(
    () => ({
      columns: Number(columns) || 1,
      gap_pt: Number(gapPt) || 40,
      date_line_gap_pt: Number(dateLineGapPt) || 14,
      slots: slots.map((slot) => ({
        key: slot.key.trim(),
        label: slot.label,
        col: Number(slot.col) || 0,
        col_span: Math.max(1, Number(slot.col_span) || 1),
        source: slot.source === "static" ? "static" : "dynamic",
        static_name: slot.source === "static" ? slot.static_name || null : null,
        show_date_line: Boolean(slot.show_date_line),
      })),
    }),
    [columns, gapPt, dateLineGapPt, slots],
  );

  const reloadTemplates = useCallback(async () => {
    setBusy("list");
    setError("");
    try {
      const [health, list] = await Promise.all([
        fetchDocumentDevHealth(),
        fetchDocumentTemplates(),
      ]);
      setConfigured(Boolean(health?.configured));
      const sorted = Array.isArray(list) ? list : [];
      setTemplates(sorted);
      if (!selectedTemplateId && sorted.length) {
        setSelectedTemplateId(String(sorted[sorted.length - 1].id));
      }
    } catch (err) {
      setError(err?.data?.message || err?.data?.error?.message || "Không tải được danh sách mẫu");
    } finally {
      setBusy("");
    }
  }, [selectedTemplateId]);

  useEffect(() => {
    if (isSuperadmin) reloadTemplates();
  }, [isSuperadmin, reloadTemplates]);

  useEffect(() => {
    setDocument(null);
  }, [selectedTemplateId]);

  function updateSlot(index, patch) {
    setSlots((prev) => prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  }

  function addSlot() {
    setSlots((prev) => [...prev, emptySlot(prev.length)]);
    setColumns((prev) => Math.max(Number(prev) || 1, slots.length + 1));
  }

  function removeSlot(index) {
    setSlots((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleSeedDemo() {
    if (!selectedTemplateId) {
      notifyError("Chọn mẫu trước");
      return;
    }
    setBusy("seed");
    setError("");
    try {
      const doc = await seedDemoDocumentForTemplate(selectedTemplateId);
      setDocument(doc);
      notifySuccess(`Đã tạo ${doc.row_count} dòng demo trong DB`);
    } catch (err) {
      const message = err?.data?.message || err?.data?.error?.message || "Không tạo được demo";
      setError(message);
      notifyError(message);
    } finally {
      setBusy("");
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    if (!uploadFile) {
      notifyError("Chọn file .xlsx trước");
      return;
    }
    setBusy("upload");
    setError("");
    try {
      const template = await uploadDocumentTemplate({
        file: uploadFile,
        name: uploadName.trim(),
        version: uploadVersion.trim(),
      });
      notifySuccess(`Đã import mẫu #${template?.id ?? ""}`);
      await reloadTemplates();
      if (template?.id) setSelectedTemplateId(String(template.id));
    } catch (err) {
      const message = err?.data?.message || err?.data?.error?.message || "Upload thất bại";
      setError(message);
      notifyError(message);
    } finally {
      setBusy("");
    }
  }

  async function handleRenderPdf() {
    if (!document?.id) {
      notifyError("Tạo dữ liệu demo trước");
      return;
    }
    for (const slot of signatureBlock.slots) {
      if (!slot.key) {
        notifyError("Mỗi slot phải có key");
        return;
      }
      if (slot.source === "static" && !slot.static_name) {
        notifyError(`Slot ${slot.key}: source=static cần static_name`);
        return;
      }
    }
    setBusy("pdf");
    setError("");
    try {
      const fresh = await fetchDocumentById(document.id);
      setDocument(fresh);
      const blob = await renderStoredDocumentPdfBlob(document.id, {
        signatures,
        signature_dates: signatureDates,
        signature_block: signatureBlock,
      });
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      notifySuccess("Đã render PDF kèm khối ký");
    } catch (err) {
      const message = err?.response?.data?.message || err?.data?.message || "Render PDF thất bại";
      setError(message);
      notifyError(message);
    } finally {
      setBusy("");
    }
  }

  if (!isSuperadmin) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Document service — trang test</h2>
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Chỉ superadmin được dùng trang test này.
          </CardContent>
        </Card>
      </section>
    );
  }

  const previewRows = (document?.rows ?? []).slice(0, 5);
  const previewColumns = previewRows.length
    ? Object.keys(previewRows[0]).filter((k) => !k.startsWith("_"))
    : [];

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.28em] text-muted-foreground">Dev only</p>
        <h2 className="text-2xl font-semibold">Document service — render từ DB</h2>
        <p className="text-xs text-muted-foreground">
          Document service:{" "}
          {configured == null ? "…" : configured ? "đã cấu hình" : "chưa cấu hình"}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-medium">1. Chọn mẫu</h3>
            <Button variant="ghost" onClick={reloadTemplates} disabled={busy !== ""}>
              <RefreshCw className={cn(busy === "list" && "animate-spin")} />
              Tải lại
            </Button>
          </div>

          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có mẫu — upload bên dưới trước.</p>
          ) : (
            <select
              className={inputClass}
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
            >
              <option value="">— Chọn mẫu —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.id} — {t.name} v{t.version}
                </option>
              ))}
            </select>
          )}

          <Button
            onClick={handleSeedDemo}
            disabled={!selectedTemplateId || busy !== ""}
            variant="secondary"
          >
            {busy === "seed" ? <Loader2 className="animate-spin" /> : <Database />}
            2. Tạo 45 dòng demo vào DB
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-medium">3. Settings khối ký</h3>
              <p className="text-xs text-muted-foreground">
                Config slot gửi kèm lúc render. Label dùng {"\\n"} để xuống dòng. Static bỏ qua
                tên trong payload.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={addSlot} disabled={busy !== ""}>
              <Plus />
              Thêm slot
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Số cột (columns)</span>
              <input
                className={inputClass}
                type="number"
                min={1}
                value={columns}
                onChange={(e) => setColumns(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">gap_pt (chỗ ký tay)</span>
              <input
                className={inputClass}
                type="number"
                min={0}
                value={gapPt}
                onChange={(e) => setGapPt(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">date_line_gap_pt</span>
              <input
                className={inputClass}
                type="number"
                min={0}
                value={dateLineGapPt}
                onChange={(e) => setDateLineGapPt(e.target.value)}
              />
            </label>
          </div>

          <div className="space-y-4">
            {slots.map((slot, index) => (
              <div
                key={`${slot.key}-${index}`}
                className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Slot #{index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={slots.length <= 1 || busy !== ""}
                    onClick={() => removeSlot(index)}
                  >
                    <Trash2 />
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="text-muted-foreground">key</span>
                    <input
                      className={inputClass}
                      value={slot.key}
                      onChange={(e) => {
                        const nextKey = e.target.value;
                        updateSlot(index, { key: nextKey });
                        setSignatures((prev) => {
                          const next = { ...prev };
                          if (slot.key && slot.key in next) {
                            next[nextKey] = next[slot.key];
                            delete next[slot.key];
                          }
                          return next;
                        });
                        setSignatureDates((prev) => {
                          const next = { ...prev };
                          if (slot.key && slot.key in next) {
                            next[nextKey] = next[slot.key];
                            delete next[slot.key];
                          }
                          return next;
                        });
                      }}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted-foreground">label (\\n = xuống dòng)</span>
                    <input
                      className={inputClass}
                      value={slot.label}
                      onChange={(e) => updateSlot(index, { label: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted-foreground">col</span>
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      value={slot.col}
                      onChange={(e) => updateSlot(index, { col: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted-foreground">col_span</span>
                    <input
                      className={inputClass}
                      type="number"
                      min={1}
                      value={slot.col_span}
                      onChange={(e) => updateSlot(index, { col_span: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted-foreground">source</span>
                    <select
                      className={inputClass}
                      value={slot.source}
                      onChange={(e) => updateSlot(index, { source: e.target.value })}
                    >
                      <option value="dynamic">dynamic (lấy từ payload)</option>
                      <option value="static">static (cố định, không override)</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted-foreground">static_name</span>
                    <input
                      className={inputClass}
                      value={slot.static_name}
                      disabled={slot.source !== "static"}
                      onChange={(e) => updateSlot(index, { static_name: e.target.value })}
                      placeholder={slot.source === "static" ? "Bắt buộc" : "Chỉ dùng khi static"}
                    />
                  </label>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(slot.show_date_line)}
                    onChange={(e) => updateSlot(index, { show_date_line: e.target.checked })}
                  />
                  show_date_line
                </label>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="text-muted-foreground">signatures[{slot.key}]</span>
                    <input
                      className={inputClass}
                      value={signatures[slot.key] ?? ""}
                      disabled={slot.source === "static"}
                      onChange={(e) =>
                        setSignatures((prev) => ({ ...prev, [slot.key]: e.target.value }))
                      }
                      placeholder={
                        slot.source === "static" ? "Bị bỏ qua (dùng static_name)" : "Tên người ký"
                      }
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted-foreground">signature_dates[{slot.key}]</span>
                    <input
                      className={inputClass}
                      value={signatureDates[slot.key] ?? ""}
                      disabled={!slot.show_date_line}
                      onChange={(e) =>
                        setSignatureDates((prev) => ({ ...prev, [slot.key]: e.target.value }))
                      }
                      placeholder={
                        slot.show_date_line
                          ? "Hà Nội, ngày … tháng … năm …"
                          : "Bật show_date_line để nhập"
                      }
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {document && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Document:</span> #{document.id} &nbsp;|&nbsp;
                <span className="text-muted-foreground">Template:</span> #{document.template_id}{" "}
                &nbsp;|&nbsp;
                <span className="text-muted-foreground">Số dòng:</span> {document.row_count}
              </p>
            </div>

            {previewRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-muted-foreground">
                      {previewColumns.map((col) => (
                        <th key={col} className="px-2 py-1 font-medium">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-b border-border/30">
                        {previewColumns.map((col) => (
                          <td key={col} className="px-2 py-1 whitespace-nowrap">
                            {row[col] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {document.row_count > 5 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    … và {document.row_count - 5} dòng nữa
                  </p>
                )}
              </div>
            )}

            <Button onClick={handleRenderPdf} disabled={busy !== ""}>
              {busy === "pdf" ? <Loader2 className="animate-spin" /> : null}
              4. Render PDF kèm khối ký
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 pt-6">
          <h3 className="font-medium">Upload mẫu Excel mới</h3>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={handleUpload}>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Tên mẫu</span>
              <input
                className={inputClass}
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                required
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Phiên bản</span>
              <input
                className={inputClass}
                value={uploadVersion}
                onChange={(e) => setUploadVersion(e.target.value)}
                required
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-muted-foreground">
                File .xlsx (có Named Range FIELD_*, TABLE_*)
              </span>
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className={inputClass}
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                required
              />
            </label>
            <div className="md:col-span-2">
              <Button type="submit" disabled={busy !== ""}>
                {busy === "upload" ? <Loader2 className="animate-spin" /> : <FileUp />}
                Upload
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
