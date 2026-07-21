import {
  Ban,
  ChevronDown,
  ChevronRight,
  ListTree,
  ListX,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Card, CardContent } from "@/components/ui/Card";
import { useConfirm } from "@/contexts/ConfirmProvider";
import {
  useCreateUnitMutation,
  useDeleteUnitMutation,
  useGetUnitsQuery,
  usePatchUnitMutation,
} from "@/features/units/api/unitsApi";
import { cn } from "@/utils/cn";
import { StickyResponsiveTable } from "@/components/common/StickyHorizontalTable";
import { notifyError, notifySuccess, notifySuccessWithUndo } from "@/services/notify";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

function sortUnitsByPath(units) {
  return [...units].sort((a, b) => (a.path || "").localeCompare(b.path || ""));
}

function isInvalidParentChoice(editUnit, candidate) {
  if (!editUnit) {
    return false;
  }
  if (candidate.id === editUnit.id) {
    return true;
  }
  const base = editUnit.path?.endsWith("/")
    ? editUnit.path
    : `${editUnit.path}/`;
  if (!base || base === "/") {
    return false;
  }
  return Boolean(
    candidate.path?.startsWith(base) && candidate.id !== editUnit.id,
  );
}

/** Descendants of `unit` by materialized path (same logic as backend subtree). */
function getDescendantIds(unit, allUnits) {
  if (!unit?.path) {
    return [];
  }
  const prefix = unit.path.endsWith("/") ? unit.path : `${unit.path}/`;
  return allUnits
    .filter((x) => x.id !== unit.id && x.path && x.path.startsWith(prefix))
    .map((x) => x.id);
}

function isUnitRowVisible(unit, byId, expandedIds) {
  let parentId = unit.parentId;
  while (parentId != null) {
    const parent = byId.get(parentId);
    if (!parent) {
      // Cha nằm ngoài danh sách (admin chỉ thấy nhánh) — không ẩn hàng theo trạng thái mở của cha vô hình.
      break;
    }
    if (!expandedIds.has(parentId)) {
      return false;
    }
    parentId = parent.parentId ?? null;
  }
  return true;
}

export function SuperadminUnitsPanel() {
  const { confirm } = useConfirm();
  const { data: units = [], isLoading, isError } = useGetUnitsQuery();
  const [createUnit, { isLoading: isCreating }] = useCreateUnitMutation();
  const [patchUnit, { isLoading: isPatching }] = usePatchUnitMutation();
  const [deleteUnit, { isLoading: isDeleting }] = useDeleteUnitMutation();

  const sorted = useMemo(() => sortUnitsByPath(units), [units]);
  const byId = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);

  /** Số đơn vị con có trong danh sách đang hiển thị (đúng với cây admin / lọc nhánh). */
  const scopedChildCountByParentId = useMemo(() => {
    const m = new Map();
    for (const u of units) {
      if (u.parentId == null) {
        continue;
      }
      const k = u.parentId;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [units]);

  const minDepthInList = useMemo(() => {
    if (!units.length) {
      return 0;
    }
    return Math.min(...units.map((u) => u.depth ?? 0));
  }, [units]);

  const treeInitRef = useRef(false);
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  useEffect(() => {
    if (!units.length || treeInitRef.current) {
      return;
    }
    treeInitRef.current = true;
    setExpandedIds(
      new Set(
        units
          .filter((u) => (scopedChildCountByParentId.get(u.id) ?? 0) > 0)
          .map((u) => u.id),
      ),
    );
  }, [units, scopedChildCountByParentId]);

  const visibleRows = useMemo(
    () => sorted.filter((u) => isUnitRowVisible(u, byId, expandedIds)),
    [sorted, byId, expandedIds],
  );

  function toggleBranch(unitId) {
    const unit = byId.get(unitId);
    if (!unit || (scopedChildCountByParentId.get(unitId) ?? 0) <= 0) {
      return;
    }
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
        for (const d of getDescendantIds(unit, units)) {
          next.delete(d);
        }
      } else {
        next.add(unitId);
      }
      return next;
    });
  }

  function expandAllBranches() {
    setExpandedIds(
      new Set(
        units
          .filter((u) => (scopedChildCountByParentId.get(u.id) ?? 0) > 0)
          .map((u) => u.id),
      ),
    );
  }

  function collapseAllBranches() {
    setExpandedIds(new Set());
  }

  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createParentId, setCreateParentId] = useState("");

  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editParentId, setEditParentId] = useState("");
  const [editActive, setEditActive] = useState(true);

  const editingUnit = useMemo(
    () => (editId ? units.find((u) => u.id === editId) : null),
    [editId, units],
  );

  function openEdit(u) {
    setEditId(u.id);
    setEditName(u.name);
    setEditDesc(u.description ?? "");
    setEditParentId(u.parentId != null ? String(u.parentId) : "");
    setEditActive(u.isActive);
  }

  function closeEdit() {
    setEditId(null);
  }

  async function onCreate(e) {
    e.preventDefault();
    if (!createName.trim()) {
      notifyError("Nhập tên đơn vị.");
      return;
    }
    try {
      await createUnit({
        name: createName.trim(),
        description: createDesc.trim() || null,
        parentId: createParentId ? Number(createParentId) : null,
      }).unwrap();
      notifySuccess("Đã tạo đơn vị.");
      setCreateName("");
      setCreateDesc("");
      setCreateParentId("");
    } catch (err) {
      notifyError(err?.data?.message || "Không tạo được đơn vị.");
    }
  }

  async function onSaveEdit(e) {
    e.preventDefault();
    if (!editId || !editName.trim()) {
      return;
    }
    try {
      await patchUnit({
        id: editId,
        name: editName.trim(),
        description: editDesc.trim() || null,
        parentId: editParentId ? Number(editParentId) : null,
        isActive: editActive,
      }).unwrap();
      notifySuccess("Đã cập nhật đơn vị.");
      closeEdit();
    } catch (err) {
      notifyError(err?.data?.message || "Không cập nhật được đơn vị.");
    }
  }

  async function onReactivate(id) {
    try {
      await patchUnit({ id, isActive: true }).unwrap();
      notifySuccess("Đã kích hoạt lại đơn vị.");
    } catch (err) {
      notifyError(err?.data?.message || "Không kích hoạt lại được.");
    }
  }

  async function onDeactivate(id) {
    const ok = await confirm({
      title: "Ngưng hoạt động đơn vị",
      message:
        "Ngưng đơn vị này? Chỉ thực hiện được khi không còn user và không còn đơn vị con.",
      confirmLabel: "Ngưng",
      cancelLabel: "Huỷ",
      variant: "danger",
    });
    if (!ok) {
      return;
    }
    try {
      await deleteUnit(id).unwrap();
      if (editId === id) {
        closeEdit();
      }
      notifySuccessWithUndo("Đã ngưng đơn vị.", async () => {
        try {
          await patchUnit({ id, isActive: true }).unwrap();
          notifySuccess("Đã hoàn tác — đơn vị hoạt động trở lại.");
        } catch (err) {
          notifyError(err?.data?.message || "Không hoàn tác được.");
        }
      });
    } catch (err) {
      notifyError(err?.data?.message || "Không thể ngưng hoạt động đơn vị.");
    }
  }

  const parentOptionsForCreate = sorted.filter((u) => (u.depth ?? 0) === 0);

  const parentOptionsForEdit = sorted.filter(
    (u) => !isInvalidParentChoice(editingUnit, u) && (u.depth ?? 0) === 0,
  );

  return (
    <Card className="shadow-soft">
      <CardContent className="flex min-h-0 flex-1 flex-col space-y-3 !p-3 sm:!p-4">
        <form
          onSubmit={onCreate}
          className="flex flex-col gap-2 p-2 border rounded-lg border-border/70 bg-card/40 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <label className="min-w-[8rem] flex-1 space-y-0.5" htmlFor="ql-sa-units-create-name">
            <span className="text-[11px] font-medium text-muted-foreground">
              Tên đơn vị mới
            </span>
            <input
              id="ql-sa-units-create-name"
              name="createUnitName"
              className={inputClass}
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Ví dụ: Phòng Kế hoạch"
            />
          </label>
          <label className="min-w-[6rem] flex-1 space-y-0.5 sm:max-w-[14rem]" htmlFor="ql-sa-units-create-parentId">
            <span className="text-[11px] font-medium text-muted-foreground">
              Đơn vị cha
            </span>
            <select
              id="ql-sa-units-create-parentId"
              name="createParentId"
              className={cn(inputClass, "py-1.5")}
              value={createParentId}
              onChange={(e) => setCreateParentId(e.target.value)}
            >
              <option value="">— Gốc (toàn hệ thống)</option>
              {parentOptionsForCreate.map((u) => (
                <option key={u.id} value={u.id}>
                  {"—".repeat(Math.max(0, u.depth - minDepthInList) + 1)} {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[10rem] flex-[2] space-y-0.5" htmlFor="ql-sa-units-create-desc">
            <span className="text-[11px] font-medium text-muted-foreground">
              Mô tả (tuỳ chọn)
            </span>
            <input
              id="ql-sa-units-create-desc"
              name="createUnitDescription"
              className={inputClass}
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
            />
          </label>
          <Button
            type="submit"
            disabled={isCreating}
            className="shrink-0 gap-1.5 px-3 py-1.5 text-xs"
            title="Thêm đơn vị"
          >
            {isCreating ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-4 shrink-0" aria-hidden />
            )}
            <span>{isCreating ? "Đang thêm…" : "Thêm đơn vị"}</span>
          </Button>
        </form>

        {isLoading ? (
          <p className="text-xs text-muted-foreground">Đang tải đơn vị…</p>
        ) : null}
        {isError ? (
          <p className="text-xs text-destructive">
            Không tải được danh sách đơn vị (kiểm tra quyền units.read).
          </p>
        ) : null}

        {!isLoading && !isError ? (
          <div className="space-y-1.5">
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <IconButton label="Mở hết nhánh" variant="surface" onClick={expandAllBranches}>
                <ListTree aria-hidden />
              </IconButton>
              <IconButton label="Thu nhánh" variant="ghost" onClick={collapseAllBranches}>
                <ListX aria-hidden />
              </IconButton>
            </div>
            <StickyResponsiveTable stickyLevel={1}>
              <table className="w-full min-w-[640px] border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-1.5 font-medium">Đơn vị</th>
                    <th className="px-2 py-1.5 font-medium">Cấp</th>
                    <th className="hidden px-2 py-1.5 font-medium md:table-cell">
                      path
                    </th>
                    <th className="px-2 py-1.5 font-medium">User</th>
                    <th className="px-2 py-1.5 font-medium">Con</th>
                    <th className="px-2 py-1.5 font-medium">HT</th>
                    <th className="px-2 py-1.5 font-medium text-right">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((u) => {
                    const scopedKids = scopedChildCountByParentId.get(u.id) ?? 0;
                    const hasChildren = scopedKids > 0;
                    const isOpen = expandedIds.has(u.id);
                    const relDepth = Math.max(0, (u.depth ?? 0) - minDepthInList);
                    const indentPx = 4 + relDepth * 14;
                    return (
                      <tr
                        key={u.id}
                        className={cn(
                          "border-b border-border/60 hover:bg-secondary/20",
                          !u.isActive && "bg-muted/25 opacity-90",
                        )}
                      >
                        <td className="px-2 py-1.5">
                          <div
                            className="flex min-w-0 items-center gap-0.5"
                            style={{ paddingLeft: indentPx }}
                          >
                            {hasChildren ? (
                              <button
                                type="button"
                                onClick={() => toggleBranch(u.id)}
                                className={cn(
                                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                )}
                                aria-expanded={isOpen}
                                title={isOpen ? "Thu gọn nhánh" : "Mở nhánh"}
                              >
                                {isOpen ? (
                                  <ChevronDown
                                    className="w-4 h-4"
                                    aria-hidden
                                  />
                                ) : (
                                  <ChevronRight
                                    className="w-4 h-4"
                                    aria-hidden
                                  />
                                )}
                              </button>
                            ) : (
                              <span
                                className="inline-flex h-7 w-7 shrink-0"
                                aria-hidden
                              />
                            )}
                            <span className="min-w-0 font-medium truncate">
                              {u.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                          {u.depth}
                        </td>
                        <td className="hidden max-w-[12rem] truncate px-2 py-1.5 font-mono text-[10px] text-muted-foreground md:table-cell">
                          {u.path}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums">
                          {u.userCount ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums" title="Số đơn vị con trong phạm vi danh sách">
                          {scopedKids > 0 ? scopedKids : "—"}
                        </td>
                        <td className="px-2 py-1.5">
                          {u.isActive ? "✓" : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <IconButton label="Sửa" variant="surface" onClick={() => openEdit(u)}>
                              <Pencil aria-hidden />
                            </IconButton>
                            {u.isActive ? (
                              <IconButton
                                label="Ngưng đơn vị"
                                variant="danger"
                                disabled={isDeleting}
                                onClick={() => onDeactivate(u.id)}
                              >
                                <Ban aria-hidden />
                              </IconButton>
                            ) : (
                              <IconButton
                                label="Kích hoạt lại đơn vị"
                                variant="surface"
                                disabled={isPatching}
                                onClick={() => onReactivate(u.id)}
                              >
                                <RotateCcw aria-hidden />
                              </IconButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </StickyResponsiveTable>
          </div>
        ) : null}

        {editId ? (
          <form
            onSubmit={onSaveEdit}
            className="p-2 space-y-2 border rounded-lg border-primary/25 bg-secondary/20 sm:p-3"
          >
            <p className="text-xs font-semibold">Sửa đơn vị #{editId}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-0.5" htmlFor={`ql-sa-units-edit-${editId}-name`}>
                <span className="text-[11px] font-medium text-muted-foreground">
                  Tên
                </span>
                <input
                  id={`ql-sa-units-edit-${editId}-name`}
                  name="editUnitName"
                  className={inputClass}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </label>
              <label className="space-y-0.5" htmlFor={`ql-sa-units-edit-${editId}-parentId`}>
                <span className="text-[11px] font-medium text-muted-foreground">
                  Cha
                </span>
                <select
                  id={`ql-sa-units-edit-${editId}-parentId`}
                  name="editParentId"
                  className={cn(inputClass, "py-1.5")}
                  value={editParentId}
                  onChange={(e) => setEditParentId(e.target.value)}
                >
                  <option value="">— Gốc</option>
                  {parentOptionsForEdit.map((u) => (
                    <option key={u.id} value={u.id}>
                      {"—".repeat(Math.max(0, u.depth - minDepthInList) + 1)} {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-0.5 sm:col-span-2" htmlFor={`ql-sa-units-edit-${editId}-desc`}>
                <span className="text-[11px] font-medium text-muted-foreground">
                  Mô tả
                </span>
                <input
                  id={`ql-sa-units-edit-${editId}-desc`}
                  name="editUnitDescription"
                  className={inputClass}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 sm:col-span-2" htmlFor={`ql-sa-units-edit-${editId}-active`}>
                <input
                  id={`ql-sa-units-edit-${editId}-active`}
                  name="editUnitActive"
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-xs">Đang hoạt động</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="submit"
                disabled={isPatching}
                className="gap-1.5 px-3 py-1.5 text-xs"
                title="Lưu đơn vị"
              >
                {isPatching ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Save className="size-4 shrink-0" aria-hidden />
                )}
                <span>{isPatching ? "Đang lưu…" : "Lưu"}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="gap-1.5 px-3 py-1.5 text-xs"
                title="Huỷ"
                onClick={closeEdit}
              >
                <X className="size-4 shrink-0" aria-hidden />
                <span>Huỷ</span>
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
