import { ChevronDown, ChevronRight, FolderClosed, FolderOpen, Loader2, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Card, CardContent } from "@/components/ui/Card";
import {
  useGetUnitLevelPermissionCapsMatrixQuery,
  useReplaceUnitLevelPermissionCapsMutation,
} from "@/features/unit-level-permission-caps/api/unitLevelPermissionCapsApi";
import { useGetUnitsQuery } from "@/features/units/api/unitsApi";
import { cn } from "@/utils/cn";
import { notifyError, notifySuccess } from "@/services/notify";

function sortUnitsByPath(units) {
  return [...units].sort((a, b) => (a.path || "").localeCompare(b.path || ""));
}

function isUnitRowVisible(unit, byId, expandedIds) {
  let parentId = unit.parentId;
  while (parentId != null) {
    if (!expandedIds.has(parentId)) {
      return false;
    }
    parentId = byId.get(parentId)?.parentId ?? null;
  }
  return true;
}

const treeRowBtn =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const EMPTY_DEPTHS = [];
const EMPTY_PERMISSIONS = [];
const EMPTY_UNITS = [];

export function SuperadminPermissionMatrixPanel() {
  const { data, isLoading, isError, error } = useGetUnitLevelPermissionCapsMatrixQuery();
  const { data: unitsRaw, isLoading: isLoadingUnits } = useGetUnitsQuery();
  const [replaceCaps, { isLoading: isSaving }] = useReplaceUnitLevelPermissionCapsMutation();

  const [selectedDepth, setSelectedDepth] = useState(null);
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [localIds, setLocalIds] = useState(() => new Set());

  const [expandedUnitIds, setExpandedUnitIds] = useState(() => new Set());
  const [expandedModules, setExpandedModules] = useState(() => new Set());

  /** Cố định tham chiếu khi chưa có data — tránh useEffect + Set state kích hoạt vòng lặp render. */
  const depths = data?.depths ?? EMPTY_DEPTHS;
  const permissions = data?.permissions ?? EMPTY_PERMISSIONS;
  const units = unitsRaw ?? EMPTY_UNITS;

  const sortedUnits = useMemo(() => sortUnitsByPath(units), [units]);
  const byId = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);

  const visibleUnits = useMemo(
    () => sortedUnits.filter((u) => isUnitRowVisible(u, byId, expandedUnitIds)),
    [sortedUnits, byId, expandedUnitIds],
  );

  const byModule = useMemo(() => {
    const map = new Map();
    for (const p of permissions) {
      const mod = p.module || "other";
      if (!map.has(mod)) {
        map.set(mod, []);
      }
      map.get(mod).push(p);
    }
    return map;
  }, [permissions]);

  const moduleKeys = useMemo(() => [...byModule.keys()].sort(), [byModule]);

  useEffect(() => {
    if (!moduleKeys.length) {
      return;
    }
    setExpandedModules((prev) => {
      if (prev.size > 0) {
        return prev;
      }
      return new Set(moduleKeys);
    });
  }, [moduleKeys]);

  useEffect(() => {
    if (!depths.length) {
      return;
    }
    if (selectedDepth === null || !depths.some((r) => r.depth === selectedDepth)) {
      setSelectedDepth(depths[0].depth);
    }
  }, [depths, selectedDepth]);

  useEffect(() => {
    const row = depths.find((d) => d.depth === selectedDepth);
    if (!row) {
      setLocalIds((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }
    const ids = row.permissionIds ?? [];
    setLocalIds((prev) => {
      if (prev.size === ids.length && ids.every((id) => prev.has(id))) {
        return prev;
      }
      return new Set(ids);
    });
  }, [depths, selectedDepth]);

  function toggleUnitBranch(unitId) {
    setExpandedUnitIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
  }

  function expandAllUnitBranches() {
    setExpandedUnitIds(new Set(sortedUnits.filter((u) => (u.childCount ?? 0) > 0).map((u) => u.id)));
  }

  function collapseAllUnitBranches() {
    setExpandedUnitIds(new Set());
  }

  function selectUnit(unit) {
    setSelectedUnitId(unit.id);
    setSelectedDepth(unit.depth ?? 0);
  }

  function toggleModule(mod) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(mod)) {
        next.delete(mod);
      } else {
        next.add(mod);
      }
      return next;
    });
  }

  function expandAllModules() {
    setExpandedModules(new Set(moduleKeys));
  }

  function collapseAllModules() {
    setExpandedModules(new Set());
  }

  function toggleId(id) {
    setLocalIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAllInModule(moduleKey) {
    const list = byModule.get(moduleKey) || [];
    setLocalIds((prev) => {
      const next = new Set(prev);
      for (const p of list) {
        next.add(p.id);
      }
      return next;
    });
  }

  function clearModule(moduleKey) {
    const list = byModule.get(moduleKey) || [];
    setLocalIds((prev) => {
      const next = new Set(prev);
      for (const p of list) {
        next.delete(p.id);
      }
      return next;
    });
  }

  async function handleSave() {
    if (selectedDepth === null) {
      return;
    }
    try {
      await replaceCaps({
        depth: selectedDepth,
        permissionIds: [...localIds],
      }).unwrap();
      notifySuccess("Đã lưu ma trận quyền cho depth đang chọn.");
    } catch (e) {
      notifyError(e?.data?.message || "Lưu thất bại.");
    }
  }

  const selectedRowMeta = depths.find((d) => d.depth === selectedDepth);
  const depthHint =
    selectedUnitId != null
      ? byId.get(selectedUnitId)?.name
      : selectedRowMeta?.label || null;

  if (isLoading) {
    return (
      <Card className="shadow-soft flex min-h-0 flex-1 flex-col">
        <CardContent className="flex flex-1 items-center !p-4">
          <p className="text-sm text-muted-foreground">Đang tải ma trận quyền…</p>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="shadow-soft flex min-h-0 flex-1 flex-col border-destructive/40">
        <CardContent className="flex flex-1 items-center !p-4">
          <p className="text-sm text-destructive">
            {error?.data?.message || "Không tải được ma trận (kiểm tra quyền unitLevelCaps.read)."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft flex min-h-0 flex-1 flex-col overflow-hidden">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 !p-3 sm:!p-4">
        <div className="shrink-0 space-y-1">
          <p className="text-xs font-medium sm:text-sm">Ma trận quyền theo depth đơn vị</p>
          <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
            Chọn đơn vị trong cây bên trái để chỉnh trần quyền ở cùng <span className="font-medium">depth</span> với
            đơn vị đó (mọi đơn vị cùng depth dùng chung một ma trận). Nhóm quyền có thể đóng/mở như thư mục.
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row lg:gap-4">
          {/* Cây đơn vị */}
          <div className="flex max-h-[40vh] shrink-0 flex-col overflow-hidden rounded-lg border border-border/70 bg-muted/15 lg:max-h-none lg:w-[min(100%,280px)] lg:shrink-0">
            <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border/60 px-2 py-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Đơn vị
              </span>
              <div className="ml-auto flex gap-1">
                <button
                  type="button"
                  className="text-[10px] font-medium text-primary hover:underline"
                  onClick={expandAllUnitBranches}
                >
                  Mở hết
                </button>
                <button
                  type="button"
                  className="text-[10px] text-muted-foreground hover:underline"
                  onClick={collapseAllUnitBranches}
                >
                  Thu hết
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-1 py-1">
              {isLoadingUnits ? (
                <p className="px-2 py-2 text-[11px] text-muted-foreground">Đang tải đơn vị…</p>
              ) : visibleUnits.length === 0 ? (
                <p className="px-2 py-2 text-[11px] text-muted-foreground">Chưa có đơn vị.</p>
              ) : (
                <ul className="space-y-0.5">
                  {visibleUnits.map((u) => {
                    const hasChildren = (u.childCount ?? 0) > 0;
                    const isOpen = expandedUnitIds.has(u.id);
                    const isSelected = selectedUnitId === u.id;
                    const indentPx = 4 + (u.depth ?? 0) * 12;
                    return (
                      <li key={u.id}>
                        <div
                          className={cn(
                            "flex min-w-0 items-center gap-0.5 rounded-md pr-1 transition",
                            isSelected ? "bg-primary/10 ring-1 ring-primary/25" : "hover:bg-background/70",
                          )}
                          style={{ paddingLeft: indentPx }}
                        >
                          {hasChildren ? (
                            <button
                              type="button"
                              className={treeRowBtn}
                              aria-expanded={isOpen}
                              title={isOpen ? "Thu gọn nhánh" : "Mở nhánh"}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleUnitBranch(u.id);
                              }}
                            >
                              {isOpen ? (
                                <ChevronDown className="h-4 w-4" aria-hidden />
                              ) : (
                                <ChevronRight className="h-4 w-4" aria-hidden />
                              )}
                            </button>
                          ) : (
                            <span className="inline-flex h-7 w-7 shrink-0" aria-hidden />
                          )}
                          <button
                            type="button"
                            className="min-w-0 flex-1 truncate py-1 text-left text-xs font-medium text-foreground"
                            onClick={() => selectUnit(u)}
                            title={`Depth ${u.depth} — ${u.name}`}
                          >
                            {u.name}
                          </button>
                          <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">d{u.depth}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Khối quyền */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 flex flex-col gap-2 border-b border-border/50 pb-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">Đang chỉnh: depth {selectedDepth ?? "—"}</p>
                {depthHint ? (
                  <p className="text-[11px] text-muted-foreground">
                    Gợi ý từ đơn vị: <span className="font-medium text-foreground">{depthHint}</span>
                  </p>
                ) : null}
                <label className="flex max-w-xs flex-col gap-0.5">
                  <span className="text-[10px] font-medium text-muted-foreground">Hoặc chọn depth trực tiếp</span>
                  <select
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm"
                    value={selectedDepth ?? ""}
                    onChange={(e) => {
                      setSelectedUnitId(null);
                      setSelectedDepth(Number(e.target.value));
                    }}
                    aria-label="Chọn depth"
                  >
                    {depths.map((row) => (
                      <option key={row.depth} value={row.depth}>
                        Depth {row.depth}
                        {row.label ? ` — ${row.label}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <IconButton
                  label="Mở nhóm"
                  variant="surface"
                  onClick={expandAllModules}
                >
                  <FolderOpen aria-hidden />
                </IconButton>
                <IconButton label="Thu nhóm" variant="ghost" onClick={collapseAllModules}>
                  <FolderClosed aria-hidden />
                </IconButton>
                <Button
                  type="button"
                  className="shrink-0 gap-1.5 px-3 py-1.5 text-xs"
                  title="Lưu ma trận depth hiện tại"
                  onClick={handleSave}
                  disabled={isSaving || selectedDepth === null}
                >
                  {isSaving ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  ) : (
                    <Save className="size-4 shrink-0" aria-hidden />
                  )}
                  <span>{isSaving ? "Đang lưu…" : "Lưu ma trận"}</span>
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain rounded-lg border border-border/70 bg-muted/10 p-2 sm:p-3">
              {moduleKeys.map((mod) => {
                const isModuleOpen = expandedModules.has(mod);
                return (
                  <div key={mod} className="rounded-md border border-border/40 bg-background/50">
                    <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-2 py-1.5">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-1 text-left"
                        onClick={() => toggleModule(mod)}
                        aria-expanded={isModuleOpen}
                      >
                        {isModuleOpen ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        )}
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {mod}
                        </span>
                      </button>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-[11px] font-medium text-primary hover:underline"
                          onClick={() => selectAllInModule(mod)}
                        >
                          Chọn cả nhóm
                        </button>
                        <button
                          type="button"
                          className="text-[11px] font-medium text-muted-foreground hover:underline"
                          onClick={() => clearModule(mod)}
                        >
                          Bỏ cả nhóm
                        </button>
                      </div>
                    </div>
                    {isModuleOpen ? (
                      <ul className="grid gap-1.5 p-2 sm:grid-cols-2">
                        {(byModule.get(mod) || []).map((p) => (
                          <li key={p.id}>
                            <label
                              className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-0.5 hover:bg-muted/40"
                              htmlFor={`ql-perm-matrix-${p.id}`}
                            >
                              <input
                                id={`ql-perm-matrix-${p.id}`}
                                name={`permission_${String(p.code).replace(/[^a-zA-Z0-9_-]/g, "_")}`}
                                type="checkbox"
                                className="mt-0.5"
                                checked={localIds.has(p.id)}
                                onChange={() => toggleId(p.id)}
                              />
                              <span className="text-xs leading-snug">
                                <span className="font-mono text-[11px] text-muted-foreground">{p.code}</span>
                                <span className="block text-foreground">{p.name}</span>
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
