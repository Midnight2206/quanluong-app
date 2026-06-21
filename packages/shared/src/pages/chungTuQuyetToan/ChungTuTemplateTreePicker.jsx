"use client";

import { ChevronRight, FileSpreadsheet, Folder, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/utils/cn";
import { useChungTuTemplateTreeQuery } from "@/features/chung-tu-quyet-toan/api/chungTuTemplateTreeApi";
import { getChungTuCategoryConfig } from "./chungTuCategoryConfig";

/**
 * @typedef {{
 *   driveFileId: string,
 *   driveFileName: string,
 *   displayName: string,
 *   categoryKey: string,
 *   folderPath: string[],
 *   fullDocumentName: string,
 *   webViewLink?: string | null,
 * }} ChungTuTemplateTreeSelection
 */

/**
 * @param {{
 *   categoryKey: string,
 *   selectedDriveFileId?: string,
 *   onSelect: (template: ChungTuTemplateTreeSelection | null) => void,
 * }} props
 */
export function ChungTuTemplateTreePicker({ categoryKey, selectedDriveFileId = "", onSelect }) {
  const config = getChungTuCategoryConfig(categoryKey);
  const rootLabel = config?.label ?? "Mẫu chứng từ";

  const [folderStack, setFolderStack] = useState([{ id: null, name: rootLabel }]);
  const currentFolderId = folderStack[folderStack.length - 1]?.id ?? null;

  useEffect(() => {
    setFolderStack([{ id: null, name: rootLabel }]);
    onSelect(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset khi đổi loại chứng từ
  }, [categoryKey, rootLabel]);

  const { data, isLoading, isError, error } = useChungTuTemplateTreeQuery(currentFolderId ?? undefined, {
    categoryKey: currentFolderId ? undefined : categoryKey,
  });

  const folders = data?.folders ?? [];
  const templates = data?.templates ?? [];

  const breadcrumb = folderStack;

  const openFolder = (folder) => {
    setFolderStack((prev) => [...prev, { id: folder.id, name: folder.name }]);
    onSelect(null);
  };

  const goToCrumb = (index) => {
    if (index < 0) return;
    if (index === 0) {
      setFolderStack([{ id: null, name: rootLabel }]);
      onSelect(null);
      return;
    }
    const next = folderStack.slice(0, index + 1);
    setFolderStack(next);
    onSelect(null);
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background/60">
      <div className="flex flex-wrap items-center gap-1 border-b border-border/70 px-2 py-2 text-[11px] text-muted-foreground">
        {breadcrumb.map((crumb, index) => (
          <span key={`${crumb.name}-${index}`} className="inline-flex items-center gap-1">
            {index > 0 ? <ChevronRight className="h-3 w-3 shrink-0 opacity-60" /> : null}
            <button
              type="button"
              className={cn(
                "rounded px-1 py-0.5 hover:bg-muted hover:text-foreground",
                index === breadcrumb.length - 1 && "font-medium text-foreground",
              )}
              onClick={() => goToCrumb(index)}
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Đang tải thư mục…
        </p>
      ) : isError ? (
        <p className="px-3 py-4 text-xs text-destructive">
          {error?.data?.message || error?.message || "Không tải được thư mục mẫu."}
        </p>
      ) : (
        <ul className="max-h-64 divide-y divide-border/60 overflow-auto">
          {folders.map((folder) => (
            <li key={folder.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/80"
                onClick={() => openFolder(folder)}
              >
                <Folder className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="min-w-0 flex-1 truncate font-medium">{folder.name}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
          {templates.map((template) => {
            const selected = selectedDriveFileId === template.driveFileId;
            return (
              <li key={template.driveFileId}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2 px-3 py-2 text-sm transition",
                    selected ? "bg-primary/10" : "hover:bg-muted/80",
                  )}
                >
                  <input
                    type="radio"
                    name={`ct-template-tree-${categoryKey}`}
                    className="mt-1"
                    checked={selected}
                    onChange={() => onSelect(template)}
                  />
                  <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {template.displayName || template.driveFileName}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {template.fullDocumentName}
                    </span>
                    {template.webViewLink ? (
                      <a
                        href={template.webViewLink}
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
              </li>
            );
          })}
          {!folders.length && !templates.length ? (
            <li className="px-3 py-4 text-xs text-muted-foreground">Thư mục trống.</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
