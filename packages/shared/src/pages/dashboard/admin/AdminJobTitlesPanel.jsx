import { useEffect, useMemo, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { Card, CardContent } from "@/components/ui/Card";
import { StickyResponsiveTable } from "@/components/common/StickyHorizontalTable";
import {
  useCreateJobTitleMutation,
  useDeleteJobTitleMutation,
  useGetJobTitlesQuery,
  usePatchJobTitleMutation,
  useSetJobTitlePermissionsMutation,
} from "@/features/job-titles/api/jobTitlesApi";
import { useCurrentUser, useHasPermission } from "@/features/auth/model/authSlice";
import { useGetUnitsQuery } from "@/features/units/api/unitsApi";
import { useGetUsersQuery, usePatchUserMutation } from "@/features/users/api/usersApi";
import { useGetPermissionsCatalogQuery } from "@/features/permissions/api/permissionsApi";
import { cn } from "@/utils/cn";
import { useConfirm } from "@/contexts/ConfirmProvider";
import { useTargetUnitScope } from "@/contexts/TargetUnitScopeContext";
import { notifyError, notifySuccess, notifySuccessWithUndo } from "@/services/notify";
import { JobTitlePermissionsModal } from "@/pages/dashboard/admin/JobTitlePermissionsModal";
import { JobTitleRenameModal } from "@/pages/dashboard/admin/JobTitleRenameModal";
import { Ban, Pencil, Plus, RotateCcw, Save, ShieldCheck } from "lucide-react";

const JT_UI_STORAGE = "admin-job-titles.v1";

function readJtUiField(key, fallback) {
  try {
    const raw = sessionStorage.getItem(JT_UI_STORAGE);
    if (!raw) {
      return fallback;
    }
    const p = JSON.parse(raw);
    if (p[key] === undefined || p[key] === null) {
      return fallback;
    }
    return p[key];
  } catch {
    return fallback;
  }
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

const P = {
  JT_READ: "jobTitles.read",
  JT_CREATE: "jobTitles.create",
  JT_PATCH: "jobTitles.patch",
  JT_DELETE: "jobTitles.delete",
  US_READ: "users.read",
  US_PATCH: "users.patch",
  PERM_READ: "permissions.read",
};

function sortUnitsByPath(units) {
  return [...units].sort((a, b) => (a.path || "").localeCompare(b.path || ""));
}

function pathPrefix(p) {
  if (!p) {
    return "";
  }
  return p.endsWith("/") ? p : `${p}/`;
}

/** Chức danh của đơn vị `titleUnit` dùng được cho user ở `userUnit` (cùng đơn vị hoặc title ở cấp trên trên nhánh path). */
function jobTitleUnitAppliesToUserUnit(titleUnit, userUnit) {
  if (!titleUnit || !userUnit) {
    return false;
  }
  if (Number(titleUnit.id) === Number(userUnit.id)) {
    return true;
  }
  const up = userUnit.path || "";
  const tp = titleUnit.path || "";
  if (!up || !tp) {
    return Number(titleUnit.id) === Number(userUnit.id);
  }
  return up === tp || up.startsWith(pathPrefix(tp));
}

function samePermissionSet(draftSet, ids) {
  const a = [...draftSet].sort((x, y) => x - y);
  const b = [...(ids ?? [])].sort((x, y) => x - y);
  if (a.length !== b.length) {
    return false;
  }
  return a.every((v, i) => v === b[i]);
}

function groupPermissionsByModule(permissions) {
  const map = new Map();
  for (const p of permissions || []) {
    if (p?.id == null || !p?.code) {
      continue;
    }
    const mod = p.module || "other";
    if (!map.has(mod)) {
      map.set(mod, []);
    }
    map.get(mod).push(p);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.code.localeCompare(b.code));
  }
  return map;
}

export function AdminJobTitlesPanel() {
  const { confirm } = useConfirm();
  const { workingUnitId } = useTargetUnitScope();
  const user = useCurrentUser();
  const canJtRead = useHasPermission(P.JT_READ);
  const canJtCreate = useHasPermission(P.JT_CREATE);
  const canJtPatch = useHasPermission(P.JT_PATCH);
  const canJtDelete = useHasPermission(P.JT_DELETE);
  const canUsRead = useHasPermission(P.US_READ);
  const canUsPatch = useHasPermission(P.US_PATCH);
  const canPermCatalogRead = useHasPermission(P.PERM_READ);

  const { data: permCatalog = [] } = useGetPermissionsCatalogQuery(undefined, {
    skip: !canJtRead || !canPermCatalogRead,
  });

  const descriptionByPermissionId = useMemo(() => {
    const m = new Map();
    for (const row of permCatalog) {
      if (row?.id != null) {
        m.set(row.id, row.description ?? null);
      }
    }
    return m;
  }, [permCatalog]);

  const actorPermissionCatalog = useMemo(
    () => (user?.permissions || []).filter((p) => p?.id != null),
    [user?.permissions],
  );
  const assignableByModule = useMemo(
    () => groupPermissionsByModule(actorPermissionCatalog),
    [actorPermissionCatalog],
  );
  const moduleKeys = useMemo(() => [...assignableByModule.keys()].sort(), [assignableByModule]);

  const { data: jobTitles = [], isLoading: jtLoading, isError: jtErr } = useGetJobTitlesQuery(
    undefined,
    { skip: !canJtRead, refetchOnMountOrArgChange: true },
  );
  const { data: units = [] } = useGetUnitsQuery(undefined, {
    skip: !canJtRead,
    refetchOnMountOrArgChange: true,
  });
  const { data: users = [], isLoading: usLoading } = useGetUsersQuery(undefined, {
    skip: !canUsRead,
    refetchOnMountOrArgChange: true,
  });

  const [createJobTitle, { isLoading: creating }] = useCreateJobTitleMutation();
  const [patchJobTitle, { isLoading: patching }] = usePatchJobTitleMutation();
  const [setJobTitlePermissions, { isLoading: savingPerms }] = useSetJobTitlePermissionsMutation();
  const [deleteJobTitle, { isLoading: deleting }] = useDeleteJobTitleMutation();
  const [patchUser, { isLoading: patchingUser }] = usePatchUserMutation();
  const [savingUserJobId, setSavingUserJobId] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);

  const sortedUnits = useMemo(() => sortUnitsByPath(units), [units]);

  const createTargetUnitId = useMemo(() => {
    const fromScope = workingUnitId != null ? Number(workingUnitId) : null;
    const fromUser = user?.unit?.id != null ? Number(user.unit.id) : null;
    if (fromScope != null) {
      return fromScope;
    }
    if (fromUser != null) {
      return fromUser;
    }
    return sortedUnits[0]?.id ?? null;
  }, [workingUnitId, user?.unit?.id, sortedUnits]);

  const createTargetUnitName = useMemo(() => {
    if (createTargetUnitId == null) {
      return null;
    }
    if (user?.unit?.id != null && Number(user.unit.id) === Number(createTargetUnitId)) {
      return user.unit.name ?? `#${createTargetUnitId}`;
    }
    return sortedUnits.find((u) => Number(u.id) === Number(createTargetUnitId))?.name ?? `#${createTargetUnitId}`;
  }, [createTargetUnitId, user?.unit, sortedUnits]);

  /** Đơn vị đã có ít nhất một admin (theo danh sách user hiện tại). */
  const unitIdsWithLocalAdmin = useMemo(() => {
    const s = new Set();
    for (const u of users) {
      if (u.type?.name === "admin" && u.isActive !== false && u.unit?.id != null) {
        s.add(Number(u.unit.id));
      }
    }
    return s;
  }, [users]);

  const [createName, setCreateName] = useState(() => readJtUiField("createName", ""));
  const [createDesc, setCreateDesc] = useState(() => readJtUiField("createDesc", ""));

  const [permEditorId, setPermEditorId] = useState(() => readJtUiField("permEditorId", null));
  const [permDraft, setPermDraft] = useState(() => new Set());
  const [userJobPicks, setUserJobPicks] = useState(() => readJtUiField("userJobPicks", {}));

  useEffect(() => {
    try {
      sessionStorage.setItem(
        JT_UI_STORAGE,
        JSON.stringify({
          createName,
          createDesc,
          userJobPicks,
          permEditorId,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [createName, createDesc, userJobPicks, permEditorId]);

  const editingRow = useMemo(
    () => jobTitles.find((j) => j.id === permEditorId),
    [jobTitles, permEditorId],
  );

  const permSaveDisabled = useMemo(() => {
    if (!editingRow) {
      return true;
    }
    return samePermissionSet(permDraft, editingRow.permissionIds);
  }, [editingRow, permDraft]);

  useEffect(() => {
    if (!editingRow?.permissionIds) {
      setPermDraft(new Set());
      return;
    }
    setPermDraft(new Set(editingRow.permissionIds));
  }, [editingRow?.id, editingRow?.permissionIds?.join(",")]);

  useEffect(() => {
    if (permEditorId != null && !jobTitles.some((j) => j.id === permEditorId)) {
      setPermEditorId(null);
    }
  }, [jobTitles, permEditorId]);

  useEffect(() => {
    if (!canUsRead || usLoading) {
      return;
    }
    const ids = new Set(users.map((u) => u.id));
    const actorNum = user?.id != null ? Number(user.id) : null;
    setUserJobPicks((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const key of Object.keys(next)) {
        const num = Number(key);
        if (!ids.has(num) || (actorNum != null && num === actorNum)) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [users, canUsRead, usLoading, user?.id]);

  function openPermEditor(row) {
    setPermEditorId(row.id);
    setPermDraft(new Set(row.permissionIds ?? []));
  }

  function togglePermDraft(pid) {
    setPermDraft((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) {
        next.delete(pid);
      } else {
        next.add(pid);
      }
      return next;
    });
  }

  async function onCreateJobTitle(e) {
    e.preventDefault();
    if (!createName.trim() || createTargetUnitId == null) {
      notifyError("Nhập tên chức danh. Chưa xác định đơn vị — chọn trên thanh phạm vi hoặc gán đơn vị cho tài khoản.");
      return;
    }
    const targetUnit = sortedUnits.find((u) => Number(u.id) === Number(createTargetUnitId));
    if ((targetUnit?.depth ?? 0) !== 0) {
      notifyError("Chỉ đơn vị cấp 1 được tạo/sửa chức danh dùng chung.");
      return;
    }
    try {
      await createJobTitle({
        unitId: Number(createTargetUnitId),
        name: createName.trim(),
        description: createDesc.trim() || null,
        isActive: true,
      }).unwrap();
      notifySuccess("Đã tạo chức danh.");
      setCreateName("");
      setCreateDesc("");
    } catch (err) {
      notifyError(err?.data?.message || "Không tạo được chức danh.");
    }
  }

  async function onSavePermissions() {
    if (permEditorId == null) {
      return;
    }
    try {
      await setJobTitlePermissions({
        id: permEditorId,
        permissionIds: [...permDraft],
      }).unwrap();
      notifySuccess("Đã cập nhật quyền chức danh (trong phạm vi quyền của bạn).");
      setPermEditorId(null);
    } catch (err) {
      notifyError(err?.data?.message || "Không lưu được quyền.");
    }
  }

  async function onDeactivateJobTitle(jt) {
    const ok = await confirm({
      title: "Ngưng chức danh",
      message: `Ngưng chức danh «${jt.name}»? Chỉ thực hiện được khi không còn user đang gán.`,
      confirmLabel: "Ngưng",
      cancelLabel: "Huỷ",
      variant: "danger",
    });
    if (!ok) {
      return;
    }
    const jobTitleId = jt.id;
    try {
      await deleteJobTitle(jobTitleId).unwrap();
      if (permEditorId === jobTitleId) {
        setPermEditorId(null);
      }
      notifySuccessWithUndo("Đã ngưng chức danh.", async () => {
        try {
          await patchJobTitle({ id: jobTitleId, isActive: true }).unwrap();
          notifySuccess("Đã hoàn tác — chức danh được kích hoạt lại.");
        } catch (err) {
          notifyError(err?.data?.message || "Không hoàn tác được.");
        }
      });
    } catch (err) {
      notifyError(err?.data?.message || "Không ngưng được chức danh.");
    }
  }

  async function onReactivateJobTitle(jt) {
    try {
      await patchJobTitle({ id: jt.id, isActive: true }).unwrap();
      notifySuccess("Đã kích hoạt lại chức danh.");
    } catch (err) {
      notifyError(err?.data?.message || "Không kích hoạt lại được.");
    }
  }

  async function onRenameJobTitleSave(newName) {
    if (renameTarget == null) {
      return;
    }
    try {
      await patchJobTitle({ id: renameTarget.id, name: newName }).unwrap();
      notifySuccess("Đã cập nhật tên.");
      setRenameTarget(null);
    } catch (err) {
      notifyError(err?.data?.message || "Không cập nhật được.");
    }
  }

  function jobTitlesForUserUnit(u) {
    const uid = u.unit?.id != null ? Number(u.unit.id) : null;
    if (uid == null) {
      return [];
    }
    const userUnit = sortedUnits.find((x) => Number(x.id) === uid);
    return jobTitles.filter((j) => {
      if (!j.isActive) {
        return false;
      }
      const titleUnit = sortedUnits.find((x) => Number(x.id) === Number(j.unitId));
      return jobTitleUnitAppliesToUserUnit(titleUnit, userUnit);
    });
  }

  function isUserJobTitleDirty(u) {
    const pick = userJobPicks[u.id];
    if (pick === undefined) {
      return false;
    }
    const next = pick === "" ? null : Number(pick);
    const cur = u.jobTitle?.id ?? null;
    return next !== cur;
  }

  async function onSaveUserJobTitle(u) {
    if (user?.id != null && Number(u.id) === Number(user.id)) {
      notifyError("Không thể tự gán chức danh cho chính mình.");
      return;
    }
    const raw = userJobPicks[u.id];
    const jobTitleId =
      raw === "" || raw === undefined ? null : Number(raw);
    setSavingUserJobId(u.id);
    try {
      await patchUser({ id: u.id, jobTitleId }).unwrap();
      notifySuccess("Đã cập nhật chức danh cho người dùng.");
      setUserJobPicks((prev) => {
        const next = { ...prev };
        delete next[u.id];
        return next;
      });
    } catch (err) {
      notifyError(err?.data?.message || "Không gán được chức danh.");
    } finally {
      setSavingUserJobId(null);
    }
  }

  if (!canJtRead) {
    return (
      <Card className="shadow-soft">
        <CardContent className="!p-4">
          <p className="text-xs text-muted-foreground">
            Bạn không có quyền <span className="font-mono">jobTitles.read</span> để quản lý chức danh.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-2">
      <Card className="shadow-soft">
        <CardContent className="flex flex-col gap-3 !p-3 sm:!p-4">
          <div className="shrink-0">
            <p className="text-xs font-medium sm:text-sm">Chức danh &amp; phân quyền</p>
          </div>

          {canJtCreate ? (
            <form
              onSubmit={onCreateJobTitle}
              className="shrink-0 space-y-2 rounded-lg border border-border/70 bg-muted/10 p-2 sm:flex sm:flex-wrap sm:items-end sm:gap-2"
            >
              <p className="w-full text-[10px] text-muted-foreground sm:w-auto sm:self-end">
                Đơn vị áp dụng:{" "}
                {createTargetUnitName ? (
                  <span className="font-medium text-foreground">{createTargetUnitName}</span>
                ) : (
                  <span className="text-destructive">chưa xác định — dùng thanh «Đơn vị đang xem»</span>
                )}
              </p>
              <label className="block min-w-[8rem] flex-1 space-y-0.5">
                <span className="text-[10px] font-medium text-muted-foreground">Tên chức danh</span>
                <input
                  className={inputClass}
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Ví dụ: Nhân viên hành chính"
                />
              </label>
              <label className="block min-w-[8rem] flex-[2] space-y-0.5">
                <span className="text-[10px] font-medium text-muted-foreground">Mô tả (tuỳ chọn)</span>
                <input
                  className={inputClass}
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                />
              </label>
              <IconButton
                type="submit"
                label="Thêm chức danh"
                variant="primary"
                loading={creating}
                disabled={creating}
              >
                <Plus strokeWidth={2} aria-hidden />
              </IconButton>
            </form>
          ) : null}

          {jtErr ? (
            <p className="text-xs text-destructive">Không tải được danh sách chức danh.</p>
          ) : null}

          <StickyResponsiveTable stickyLevel={1} className="border-border/60">
            {jtLoading ? (
              <p className="p-3 text-xs text-muted-foreground">Đang tải…</p>
            ) : (
              <table className="w-full min-w-[520px] border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-1.5 font-medium">Chức danh</th>
                    <th className="px-2 py-1.5 font-medium">Đơn vị</th>
                    <th className="px-2 py-1.5 font-medium">Số quyền đã gán</th>
                    <th className="px-2 py-1.5 font-medium">HT</th>
                    <th className="px-2 py-1.5 text-right font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {jobTitles.map((jt) => {
                    const unitName = units.find((u) => u.id === jt.unitId)?.name ?? `#${jt.unitId}`;
                    const nPerm = jt.permissionIds?.length ?? 0;
                    const isPermRow = permEditorId === jt.id;
                    return (
                      <tr
                        key={jt.id}
                        className={cn(
                          "border-b border-border/50 align-top transition-colors hover:bg-muted/20",
                          isPermRow && "bg-primary/8 ring-1 ring-inset ring-primary/25",
                        )}
                      >
                        <td className="px-2 py-1.5">
                          <span className="font-medium">{jt.name}</span>
                          {jt.description ? (
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">{jt.description}</span>
                          ) : null}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">{unitName}</td>
                        <td className="px-2 py-1.5 tabular-nums">{nPerm}</td>
                        <td className="px-2 py-1.5">{jt.isActive ? "✓" : "—"}</td>
                        <td className="px-2 py-1.5 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            {canJtPatch ? (
                              <IconButton
                                label="Phân quyền gói quyền"
                                variant="primary"
                                disabled={!jt.isActive}
                                onClick={() => openPermEditor(jt)}
                              >
                                <ShieldCheck aria-hidden />
                              </IconButton>
                            ) : null}
                            {canJtPatch ? (
                              <IconButton
                                label="Đổi tên"
                                variant="ghost"
                                disabled={patching || !jt.isActive}
                                onClick={() => setRenameTarget(jt)}
                              >
                                <Pencil aria-hidden />
                              </IconButton>
                            ) : null}
                            {!jt.isActive && canJtPatch ? (
                              <IconButton
                                label="Kích hoạt lại"
                                variant="surface"
                                disabled={patching}
                                onClick={() => onReactivateJobTitle(jt)}
                              >
                                <RotateCcw aria-hidden />
                              </IconButton>
                            ) : null}
                            {canJtDelete && jt.isActive ? (
                              <IconButton
                                label="Ngưng"
                                variant="danger"
                                disabled={deleting || patching}
                                onClick={() => onDeactivateJobTitle(jt)}
                              >
                                <Ban aria-hidden />
                              </IconButton>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </StickyResponsiveTable>

          {canJtPatch ? (
            <JobTitlePermissionsModal
              open={permEditorId != null}
              onClose={() => setPermEditorId(null)}
              editingRow={editingRow}
              units={units}
              moduleKeys={moduleKeys}
              assignableByModule={assignableByModule}
              actorPermissionCatalog={actorPermissionCatalog}
              permDraft={permDraft}
              onSelectAllAssignable={() =>
                setPermDraft(new Set(actorPermissionCatalog.map((p) => p.id)))
              }
              onClearAll={() => setPermDraft(new Set())}
              togglePermDraft={togglePermDraft}
              onSave={onSavePermissions}
              savingPerms={savingPerms}
              saveDisabled={permSaveDisabled}
              descriptionByPermissionId={canPermCatalogRead ? descriptionByPermissionId : null}
            />
          ) : null}

          {canJtPatch ? (
            <JobTitleRenameModal
              open={renameTarget != null}
              jobTitle={renameTarget}
              unitLabel={
                renameTarget
                  ? units.find((u) => u.id === renameTarget.unitId)?.name ?? `#${renameTarget.unitId}`
                  : ""
              }
              onClose={() => setRenameTarget(null)}
              onSave={onRenameJobTitleSave}
              saving={patching && renameTarget != null}
            />
          ) : null}

        </CardContent>
      </Card>

      {canUsRead && canUsPatch ? (
        <Card className="shadow-soft">
          <CardContent className="flex flex-col gap-2 !p-3 sm:!p-4">
            <p className="shrink-0 text-xs font-medium sm:text-sm">Gán chức danh cho nhân sự (nhận gói phân quyền)</p>
            
            <StickyResponsiveTable stickyLevel={1} className="border-border/60">
              {usLoading ? (
                <p className="p-3 text-xs text-muted-foreground">Đang tải người dùng…</p>
              ) : (
                <table className="w-full min-w-[560px] border-collapse text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-1.5 font-medium">Người dùng</th>
                      <th className="px-2 py-1.5 font-medium">Đơn vị</th>
                      <th className="px-2 py-1.5 font-medium">Chức danh hiện tại</th>
                      <th className="px-2 py-1.5 font-medium">Gán mới</th>
                      <th className="px-2 py-1.5 text-right font-medium">Lưu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const options = jobTitlesForUserUnit(u);
                      const uid = u.unit?.id != null ? Number(u.unit.id) : null;
                      const hasLocalAdmin = uid != null && unitIdsWithLocalAdmin.has(uid);
                      const pick = userJobPicks[u.id];
                      const selectValue =
                        pick !== undefined ? pick : u.jobTitle?.id != null ? String(u.jobTitle.id) : "";
                      const dirty = isUserJobTitleDirty(u);
                      const isSelf = user?.id != null && Number(u.id) === Number(user.id);
                      return (
                        <tr
                          key={u.id}
                          className={cn(
                            "border-b border-border/50 align-middle hover:bg-muted/15",
                            isSelf && "bg-muted/20",
                          )}
                        >
                          <td className="px-2 py-1.5">
                            <div className="font-medium">{u.profile?.fullName || u.username}</div>
                            <div className="text-[11px] text-muted-foreground">{u.email}</div>
                          </td>
                          <td className="max-w-[8rem] truncate px-2 py-1.5 text-muted-foreground">
                            {u.unit?.name ?? "—"}
                          </td>
                          <td className="px-2 py-1.5 text-[11px]">
                            {u.jobTitle?.name ?? "—"}
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              className={cn(inputClass, "max-w-[16rem] py-1 text-[11px] sm:max-w-[20rem]")}
                              value={selectValue}
                              onChange={(e) =>
                                setUserJobPicks((prev) => ({
                                  ...prev,
                                  [u.id]: e.target.value,
                                }))
                              }
                              disabled={!u.unit?.id || isSelf}
                            >
                              <option value="">— Không chức danh —</option>
                              {options.map((jt) => (
                                <option key={jt.id} value={jt.id}>
                                  {jt.name}
                                  {Number(jt.unitId) !== uid ? ` (${units.find((x) => x.id === jt.unitId)?.name ?? jt.unitId})` : ""}
                                </option>
                              ))}
                            </select>
                            {isSelf ? (
                              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                                Không thể tự gán chức danh cho chính mình.
                              </span>
                            ) : !u.unit?.id ? (
                              <span className="mt-0.5 block text-[10px] text-amber-600">
                                User chưa có đơn vị
                              </span>
                            ) : options.length === 0 ? (
                              <span className="mt-0.5 block text-[10px] text-amber-700">
                                {hasLocalAdmin
                                  ? "Chưa có chức danh cho đơn vị này — tạo ở bảng trên."
                                  : "Chưa có chức danh phù hợp — tạo ở đơn vị này hoặc đơn vị cấp trên trên cùng nhánh."}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <IconButton
                              label="Lưu gán chức danh"
                              variant="surface"
                              disabled={
                                patchingUser || !dirty || savingUserJobId != null || isSelf
                              }
                              loading={savingUserJobId === u.id}
                              onClick={() => onSaveUserJobTitle(u)}
                            >
                              <Save aria-hidden />
                            </IconButton>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </StickyResponsiveTable>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-soft">
          <CardContent className="!p-4">
            <p className="text-xs text-muted-foreground">
              Cần quyền <span className="font-mono">users.read</span> và{" "}
              <span className="font-mono">users.patch</span> để gán chức danh cho nhân sự tại đây.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
