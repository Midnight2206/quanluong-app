import { useEffect } from "react";
import { ListChecks, ListX, Save, X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/utils/cn";

export function JobTitlePermissionsModal({
  open,
  onClose,
  editingRow,
  units,
  moduleKeys,
  assignableByModule,
  actorPermissionCatalog,
  permDraft,
  onSelectAllAssignable,
  onClearAll,
  togglePermDraft,
  onSave,
  savingPerms,
  saveDisabled,
  /** Map permission id → mô tả mới nhất từ API catalog (dùng chung, ưu tiên hơn mô tả trong JWT). */
  descriptionByPermissionId,
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function onKey(e) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !editingRow) {
    return null;
  }

  const unitLabel = units.find((x) => x.id === editingRow.unitId)?.name ?? `#${editingRow.unitId}`;
  const saveBlocked = saveDisabled || savingPerms || !actorPermissionCatalog.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-background/80 backdrop-blur-[1px]"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-title-perm-modal-title"
        className={cn(
          "relative flex max-h-[min(92dvh,48rem)] w-full max-w-3xl flex-col rounded-t-2xl border border-border bg-card shadow-lg sm:rounded-2xl",
        )}
      >
        <div className="shrink-0 space-y-1 border-b border-border px-4 pb-3 pt-4 sm:px-5">
          <p
            id="job-title-perm-modal-title"
            className="text-[10px] font-semibold uppercase tracking-wide text-primary"
          >
            Phân quyền cho chức danh
          </p>
          <p className="text-sm font-medium text-foreground">
            {editingRow.name}{" "}
            <span className="font-normal text-muted-foreground">— đơn vị: {unitLabel}</span>
          </p>
          
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3 sm:px-5">
          {actorPermissionCatalog.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Tài khoản của bạn không có quyền chi tiết để ủy quyền cho chức danh. Kiểm tra vai trò và ma trận cấp đơn
              vị; có thể cần đăng xuất và đăng nhập lại.
            </p>
          ) : (
            <div className="space-y-3">
              {moduleKeys.map((mod) => (
                <div key={mod}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase text-muted-foreground">{mod}</p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {(assignableByModule.get(mod) || []).map((p) => {
                      const catalogDesc = descriptionByPermissionId?.get(p.id);
                      const descRaw = catalogDesc ?? p.description;
                      const desc =
                        descRaw != null && String(descRaw).trim() !== ""
                          ? String(descRaw).trim()
                          : null;
                      return (
                        <li key={p.id}>
                          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-transparent px-1 py-1 text-[11px] hover:bg-muted/30">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={permDraft.has(p.id)}
                              onChange={() => togglePermDraft(p.id)}
                            />
                            <span className="min-w-0">
                              <span className="block font-medium text-foreground">{p.name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">{p.code}</span>
                              {desc ? (
                                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                                  {desc}
                                </span>
                              ) : (
                                <span className="mt-0.5 block text-[10px] italic text-muted-foreground/80">
                                  Chưa có mô tả chung — superadmin có thể bổ sung ở tab «Mô tả quyền (dùng chung)».
                                </span>
                              )}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-5">
          <div className="flex flex-wrap gap-1.5">
            <IconButton
              label="Chọn tất cả"
              variant="surface"
              tooltipSide="top"
              disabled={!actorPermissionCatalog.length}
              onClick={onSelectAllAssignable}
            >
              <ListChecks aria-hidden />
            </IconButton>
            <IconButton label="Bỏ chọn" variant="ghost" tooltipSide="top" onClick={onClearAll}>
              <ListX aria-hidden />
            </IconButton>
          </div>
          <div className="flex gap-1.5">
            <IconButton label="Đóng" variant="ghost" tooltipSide="top" onClick={onClose}>
              <X aria-hidden />
            </IconButton>
            <IconButton
              label="Lưu phân quyền"
              variant="primary"
              tooltipSide="top"
              disabled={saveBlocked}
              loading={savingPerms}
              onClick={onSave}
            >
              <Save aria-hidden />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
}
