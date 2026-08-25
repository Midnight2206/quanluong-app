"use client";

import { BookOpen, FileUp, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { StickyResponsiveTable } from "@/components/common/StickyHorizontalTable";
import { useConfirm } from "@/contexts/ConfirmProvider";
import {
  useChungTuPdfFieldCatalogQuery,
  useChungTuPdfTemplateFieldsQuery,
  useChungTuPdfTemplatesQuery,
  openChungTuPdfTemplatePreview,
  usePublishChungTuPdfTemplateMutation,
  useRetireChungTuPdfTemplateMutation,
  useUploadChungTuPdfTemplateMutation,
} from "@/features/chung-tu-quyet-toan/api/chungTuPdfApi";
import { notifyError, notifySuccess } from "@/services/notify";
import { cn } from "@/utils/cn";

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function getTemplateLabel(template) {
  if (!template) return "";
  const base = template.displayName || template.name || `Mẫu #${template.id}`;
  return template.version ? `${base} (v${template.version})` : base;
}

function formatUpdatedAt(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN");
}

function getTemplateStatusMeta(status) {
  switch (status) {
    case "draft":
      return {
        label: "Nháp",
        className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
      };
    case "published":
      return {
        label: "Đã duyệt",
        className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
      };
    case "retired":
      return {
        label: "Đã ngừng",
        className: "bg-muted text-muted-foreground",
      };
    default:
      return {
        label: status || "—",
        className: "bg-muted text-muted-foreground",
      };
  }
}

function normalizeTemplateSchema(payload) {
  const root = payload && typeof payload === "object" ? payload : {};
  const schema = root.fields && typeof root.fields === "object" ? root.fields : root;
  const scalarFields = Array.isArray(schema.fields) ? schema.fields : [];
  const columns = Array.isArray(schema.columns) ? schema.columns : [];
  const signatureBlock =
    schema.signature_block ?? schema.signatureBlock ?? root.signature_block ?? root.signatureBlock ?? null;
  return { scalarFields, columns, signatureBlock };
}

/**
 * @param {{ categoryKey: string }} props
 */
export function SuperadminChungTuPdfCategoryTemplates({ categoryKey }) {
  const { confirm } = useConfirm();
  const [selectedId, setSelectedId] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadDisplayName, setUploadDisplayName] = useState("");
  const [uploadVersion, setUploadVersion] = useState("1");
  const [previewingId, setPreviewingId] = useState("");

  const { data: templates = [], isLoading: templatesLoading } = useChungTuPdfTemplatesQuery(
    categoryKey,
    { includeNonPublished: true },
  );
  const { data: fieldCatalog, isLoading: fieldCatalogLoading } = useChungTuPdfFieldCatalogQuery();
  const { data: fieldsPayload, isLoading: fieldsLoading } = useChungTuPdfTemplateFieldsQuery(
    selectedId,
    { skip: !selectedId },
  );
  const [uploadTemplate, { isLoading: uploading }] = useUploadChungTuPdfTemplateMutation();
  const [publishTemplate, { isLoading: publishing }] = usePublishChungTuPdfTemplateMutation();
  const [retireTemplate, { isLoading: retiring }] = useRetireChungTuPdfTemplateMutation();

  const selectedTemplate = useMemo(
    () => templates.find((t) => String(t.id) === String(selectedId)) ?? null,
    [selectedId, templates],
  );
  const templateSchema = useMemo(() => normalizeTemplateSchema(fieldsPayload), [fieldsPayload]);

  const handleUpload = async () => {
    if (!uploadFile) {
      notifyError("Chọn file mẫu .xlsx trước khi tải lên.");
      return;
    }
    const baseName = uploadFile.name.replace(/\.[^.]+$/, "").trim();
    const displayName = uploadDisplayName.trim() || baseName || "Mẫu PDF";
    const version = uploadVersion.trim() || "1";
    try {
      const template = await uploadTemplate({
        file: uploadFile,
        categoryKey,
        displayName,
        name: displayName,
        version,
      }).unwrap();
      if (template?.id != null) {
        setSelectedId(String(template.id));
      }
      setUploadFile(null);
      notifySuccess(`Đã tải mẫu PDF "${displayName}".`);
    } catch (e) {
      notifyError(e?.data?.message || e?.message || "Không tải được mẫu PDF.");
    }
  };

  const handlePreview = async (template) => {
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      notifyError("Trình duyệt chặn cửa sổ mới. Hãy cho phép popup cho trang này.");
      return;
    }
    try {
      setPreviewingId(String(template.id));
      await openChungTuPdfTemplatePreview(template.id, { targetWindow: tab });
    } catch (e) {
      try {
        tab.close();
      } catch {}
      notifyError(e?.data?.message || e?.message || "Không mở được bản xem trước.");
    } finally {
      setPreviewingId("");
    }
  };

  const handlePublish = async (template) => {
    const ok = await confirm({
      title: "Xuất bản mẫu PDF?",
      message: `Mẫu "${getTemplateLabel(template)}" sẽ được dùng cho đơn vị khi xuất chứng từ.`,
      confirmLabel: "Xuất bản",
    });
    if (!ok) return;
    try {
      await publishTemplate({ id: template.id, categoryKey }).unwrap();
      notifySuccess("Đã xuất bản mẫu PDF.");
    } catch (e) {
      notifyError(e?.data?.message || e?.message || "Không xuất bản được mẫu PDF.");
    }
  };

  const handleRetire = async (template) => {
    const ok = await confirm({
      title: "Ngừng dùng mẫu PDF?",
      message: `Mẫu "${getTemplateLabel(template)}" sẽ không còn hiển thị cho đơn vị khi xuất chứng từ.`,
      confirmLabel: "Ngừng dùng",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await retireTemplate({ id: template.id, categoryKey }).unwrap();
      notifySuccess("Đã ngừng dùng mẫu PDF.");
    } catch (e) {
      notifyError(e?.data?.message || e?.message || "Không ngừng được mẫu PDF.");
    }
  };

  const tableBody = templates.map((row) => {
    const statusMeta = getTemplateStatusMeta(row.status);
    return (
      <tr key={row.id} className="border-b border-border/60 last:border-0">
        <td className="px-2 py-2">
          <button
            type="button"
            className={cn(
              "text-left text-xs font-medium text-foreground underline-offset-2 hover:underline",
              String(row.id) === String(selectedId) && "text-primary",
            )}
            onClick={() => setSelectedId(String(row.id))}
          >
            {getTemplateLabel(row)}
          </button>
        </td>
        <td className="px-2 py-2 text-xs">{row.version ?? "—"}</td>
        <td className="px-2 py-2">
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
              statusMeta.className,
            )}
          >
            {statusMeta.label}
          </span>
        </td>
        <td className="whitespace-nowrap px-2 py-2 text-xs text-muted-foreground">
          {formatUpdatedAt(row.updatedAt)}
        </td>
        <td className="px-2 py-2 text-right">
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={previewingId === String(row.id)}
              onClick={() => handlePreview(row)}
            >
              {previewingId === String(row.id) ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Xem trước
            </Button>
            {row.status === "draft" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={publishing || retiring}
                onClick={() => handlePublish(row)}
              >
                Xuất bản
              </Button>
            ) : null}
            {row.status === "draft" || row.status === "published" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={publishing || retiring}
                onClick={() => handleRetire(row)}
              >
                Ngừng dùng
              </Button>
            ) : null}
          </div>
        </td>
      </tr>
    );
  });

  return (
    <div className="space-y-4">
      <Card className="shadow-soft">
        <CardContent className="space-y-3 !p-3 sm:!p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Tải mẫu Excel</p>
            <p className="text-xs text-muted-foreground">
              Upload file .xlsx đã chuẩn Named Ranges của document-service cho loại chứng từ này.
            </p>
          </div>

          <label className="block space-y-1" htmlFor={`sa-ct-template-file-${categoryKey}`}>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
              File mẫu
            </span>
            <input
              id={`sa-ct-template-file-${categoryKey}`}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className={fieldClass}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setUploadFile(file);
                if (file) {
                  setUploadDisplayName(file.name.replace(/\.[^.]+$/, ""));
                }
              }}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1" htmlFor={`sa-ct-template-name-${categoryKey}`}>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                Tên hiển thị
              </span>
              <input
                id={`sa-ct-template-name-${categoryKey}`}
                className={fieldClass}
                value={uploadDisplayName}
                onChange={(e) => setUploadDisplayName(e.target.value)}
                placeholder="Ví dụ: BKMH C34"
              />
            </label>
            <label className="block space-y-1" htmlFor={`sa-ct-template-version-${categoryKey}`}>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
                Phiên bản
              </span>
              <input
                id={`sa-ct-template-version-${categoryKey}`}
                className={fieldClass}
                value={uploadVersion}
                onChange={(e) => setUploadVersion(e.target.value)}
                placeholder="1"
              />
            </label>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 gap-1.5 text-xs"
            disabled={uploading || !uploadFile}
            onClick={handleUpload}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileUp className="h-3.5 w-3.5" />
            )}
            Tải mẫu Excel
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardContent className="space-y-3 !p-3 sm:!p-4">
          <p className="text-sm font-medium text-foreground">Danh sách mẫu</p>
          {templatesLoading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Đang tải…
            </p>
          ) : templates.length === 0 ? (
            <p className="text-xs text-muted-foreground">Chưa có mẫu PDF cho loại chứng từ này.</p>
          ) : (
            <StickyResponsiveTable stickyLevel={1} className="border-border/60">
              <table className="w-full min-w-[640px] border-collapse text-left text-xs sm:text-sm">
                <thead className="bg-secondary/95">
                  <tr className="border-b border-border text-[10px] uppercase text-muted-foreground">
                    <th className="min-w-[12rem] px-2 py-2 font-medium">Tên hiển thị</th>
                    <th className="px-2 py-2 font-medium">Phiên bản</th>
                    <th className="px-2 py-2 font-medium">Trạng thái</th>
                    <th className="px-2 py-2 font-medium">Cập nhật</th>
                    <th className="px-2 py-2 text-right font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody>{tableBody}</tbody>
              </table>
            </StickyResponsiveTable>
          )}
        </CardContent>
      </Card>

      {selectedTemplate ? (
        <Card className="shadow-soft">
          <CardContent className="space-y-3 !p-3 sm:!p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Named Range trên mẫu</p>
              <p className="text-xs text-muted-foreground">
                Mẫu đang chọn: {getTemplateLabel(selectedTemplate)}
              </p>
            </div>
            {fieldsLoading ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Đang đọc schema…
              </p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-2 rounded-lg border border-border/60 bg-muted/10 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                    Scalar fields
                  </p>
                  <div className="space-y-2 text-xs">
                    {templateSchema.scalarFields.length === 0 ? (
                      <p className="text-muted-foreground">Không có field đơn.</p>
                    ) : (
                      templateSchema.scalarFields.map((field) => (
                        <div
                          key={field.field_name ?? field.key}
                          className="rounded-md bg-background px-2.5 py-2"
                        >
                          <p className="font-mono text-[11px] text-foreground">
                            {field.field_name ?? field.key}
                          </p>
                          {field.cell_ref ? (
                            <p className="mt-0.5 text-muted-foreground">cell: {field.cell_ref}</p>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border border-border/60 bg-muted/10 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                    Cột bảng
                  </p>
                  <div className="space-y-2 text-xs">
                    {templateSchema.columns.length === 0 ? (
                      <p className="text-muted-foreground">Không có cột bảng.</p>
                    ) : (
                      templateSchema.columns.map((column) => (
                        <div
                          key={column.key}
                          className="rounded-md bg-background px-2.5 py-2"
                        >
                          <p className="font-medium text-foreground">{column.title ?? column.key}</p>
                          <p className="mt-0.5 text-muted-foreground">key: {column.key}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
            {templateSchema.signatureBlock?.slots?.length ? (
              <div className="space-y-2 rounded-lg border border-border/60 bg-muted/10 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-foreground">
                  Chữ ký
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {templateSchema.signatureBlock.slots.map((slot) => (
                    <span
                      key={slot.key}
                      className="rounded-md bg-background px-2 py-1 text-muted-foreground"
                    >
                      {slot.key}
                      {slot.label ? `: ${String(slot.label).replace(/\\n/g, " ")}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <details className="rounded-xl border border-border/70 bg-muted/10">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium text-foreground">
          <BookOpen className="size-4 text-muted-foreground" />
          Catalog gợi ý (chuẩn hệ thống)
        </summary>
        <div className="space-y-3 border-t border-border/60 px-3 py-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Dùng các Named Range `FIELD_*` cho dữ liệu đơn và `TABLE_HEADER`/`TABLE_DATA_ROW` cho
            phần bảng dòng hàng khi thiết kế mẫu Excel.
          </p>
          {fieldCatalogLoading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Đang tải catalog…
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
}
