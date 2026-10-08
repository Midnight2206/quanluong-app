import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDraftPersist } from "@/hooks/useDraftPersist";
import { Loader2, Power, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Card, CardContent } from "@/components/ui/Card";
import { StickyResponsiveTable } from "@/components/common/StickyHorizontalTable";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  getLttpSupplierUserLinksQueryOptions,
  useLttpSupplierCatalogQuery,
} from "@/features/lttp-supplier/api/lttpSupplierApi";
import { useGetTypesQuery } from "@/features/types/api/typesApi";
import { useGetUnitsQuery } from "@/features/units/api/unitsApi";
import {
  useCreateUserMutation,
  useGetUsersQuery,
  usePatchUserMutation,
} from "@/features/users/api/usersApi";
import { cn } from "@/utils/cn";
import { notifyError, notifySuccess } from "@/services/notify";
import {
  supplierCreateBlockReason,
  supplierCreateBody,
  supplierEditBlockReason,
  supplierEditPatch,
  supplierIdsFromLinks,
} from "./supplierUserForm.js";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

function sortUnitsByPath(units) {
  return [...units].sort((a, b) => (a.path || "").localeCompare(b.path || ""));
}

function toggleSupplierId(list, supplierId) {
  return list.includes(supplierId)
    ? list.filter((id) => id !== supplierId)
    : [...list, supplierId];
}

export function SuperadminUsersPanel() {
  const queryClient = useQueryClient();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { data: users = [], isLoading, isError } = useGetUsersQuery();
  const { data: types = [] } = useGetTypesQuery();
  const { data: units = [] } = useGetUnitsQuery();
  const sortedUnits = useMemo(() => sortUnitsByPath(units), [units]);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [typeId, setTypeId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [supplierIds, setSupplierIds] = useState([]);
  const selectedUnitDepth = useMemo(() => {
    if (!unitId) return null;
    return sortedUnits.find((u) => String(u.id) === String(unitId))?.depth ?? null;
  }, [unitId, sortedUnits]);
  const typesForCreate = useMemo(() => {
    if (selectedUnitDepth != null && selectedUnitDepth !== 0) {
      return types.filter((t) => t.name !== "admin");
    }
    return types;
  }, [types, selectedUnitDepth]);
  const selectedTypeName = useMemo(
    () => typesForCreate.find((t) => String(t.id) === String(typeId))?.name ?? "",
    [typeId, typesForCreate],
  );
  const isSupplierCreateType = selectedTypeName === "lttp_supplier";

  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [patchUser, { isLoading: isPatching }] = usePatchUserMutation();
  const [togglingUserId, setTogglingUserId] = useState(null);
  const [editingSupplierUser, setEditingSupplierUser] = useState(null);
  const [editingSupplierIds, setEditingSupplierIds] = useState([]);
  const [loadingSupplierUserId, setLoadingSupplierUserId] = useState(null);
  const [savingSupplierUserId, setSavingSupplierUserId] = useState(null);
  const shouldLoadSupplierCatalog = isSupplierCreateType || editingSupplierUser != null;
  // Load /lttp-supplier/catalog only when the create/editor supplier UI is visible.
  const {
    data: supplierCatalogData,
    isLoading: isSupplierCatalogLoading,
    isError: isSupplierCatalogError,
  } =
    useLttpSupplierCatalogQuery({ skip: !shouldLoadSupplierCatalog });
  const suppliers = useMemo(
    () => (Array.isArray(supplierCatalogData?.suppliers) ? supplierCatalogData.suppliers : []),
    [supplierCatalogData],
  );
  const hasEmptySupplierCatalog = !isSupplierCatalogLoading && !isSupplierCatalogError && suppliers.length === 0;

  const {
    draft: createUserDraft,
    setDraftPayload: persistCreateUser,
    clear: clearCreateUserDraft,
    ready: createUserPersistReady,
  } = useDraftPersist({ draftType: "sa-users-create", scopeId: "global" });
  const createUserHydratedRef = useRef(false);
  const createUserReadyRef = useRef(false);

  useLayoutEffect(() => {
    if (!createUserPersistReady || createUserHydratedRef.current) {
      return;
    }
    createUserHydratedRef.current = true;
    const s = createUserDraft;
    if (s) {
      if (typeof s.username === "string") {
        setUsername(s.username);
      }
      if (typeof s.email === "string") {
        setEmail(s.email);
      }
      if (typeof s.fullName === "string") {
        setFullName(s.fullName);
      }
      if (s.typeId !== undefined) {
        setTypeId(s.typeId);
      }
      if (s.unitId !== undefined) {
        setUnitId(s.unitId);
      }
      if (Array.isArray(s.supplierIds)) {
        setSupplierIds(
          s.supplierIds
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id)),
        );
      }
    }
    createUserReadyRef.current = true;
  }, [createUserPersistReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!createUserReadyRef.current || !createUserPersistReady) {
      return;
    }
    persistCreateUser({
      username,
      email,
      fullName,
      typeId,
      unitId,
      supplierIds,
    });
  }, [
    username,
    email,
    fullName,
    typeId,
    unitId,
    supplierIds,
    createUserPersistReady,
    persistCreateUser,
  ]);

  async function onCreateUser(e) {
    e.preventDefault();
    const blockReason = supplierCreateBlockReason({
      isSupplierCreateType,
      catalogFailed: isSupplierCatalogError,
      supplierIds,
      username,
      email,
      password,
      fullName,
      typeId,
    });
    if (blockReason) {
      notifyError(blockReason);
      return;
    }
    try {
      await createUser(supplierCreateBody({
        isSupplierCreateType,
        supplierIds,
        unitId,
        username,
        email,
        password,
        fullName,
        typeId,
      })).unwrap();
      notifySuccess("Đã tạo người dùng.");
      setUsername("");
      setEmail("");
      setPassword("");
      setFullName("");
      setTypeId("");
      setUnitId("");
      setSupplierIds([]);
      void clearCreateUserDraft();
    } catch (err) {
      notifyError(err?.data?.message || "Không tạo được người dùng.");
    }
  }

  async function toggleActive(u) {
    setTogglingUserId(u.id);
    try {
      await patchUser({ id: u.id, isActive: !u.isActive }).unwrap();
      notifySuccess(
        u.isActive
          ? "Đã vô hiệu hoá tài khoản."
          : "Đã kích hoạt lại tài khoản.",
      );
    } catch (err) {
      notifyError(err?.data?.message || "Không cập nhật được trạng thái.");
    } finally {
      setTogglingUserId(null);
    }
  }

  async function openSupplierEditor(user) {
    setLoadingSupplierUserId(user.id);
    try {
      // Fetch /lttp-supplier/users/:id/links before opening the editor.
      const data = await queryClient.fetchQuery(
        getLttpSupplierUserLinksQueryOptions(user.id),
      );
      setEditingSupplierIds(supplierIdsFromLinks(data));
      setEditingSupplierUser(user);
    } catch (err) {
      notifyError(err?.data?.message || "Không tải được danh sách nhà cung cấp.");
    } finally {
      setLoadingSupplierUserId(null);
    }
  }

  function closeSupplierEditor() {
    setEditingSupplierUser(null);
    setEditingSupplierIds([]);
  }

  async function saveSupplierEditor() {
    if (!editingSupplierUser) {
      return;
    }
    const blockReason = supplierEditBlockReason(editingSupplierIds);
    if (blockReason) {
      notifyError(blockReason);
      return;
    }
    setSavingSupplierUserId(editingSupplierUser.id);
    try {
      await patchUser(supplierEditPatch(editingSupplierUser.id, editingSupplierIds)).unwrap();
      notifySuccess("Đã cập nhật nhà cung cấp.");
      closeSupplierEditor();
    } catch (err) {
      notifyError(err?.data?.message || "Không cập nhật được nhà cung cấp.");
    } finally {
      setSavingSupplierUserId(null);
    }
  }

  return (
    <Card className="shadow-soft min-w-0">
      <CardContent className="min-w-0 space-y-3 !p-3 sm:!p-4">
        <form
          data-local-commit-form="true"
          onSubmit={onCreateUser}
          className="grid shrink-0 gap-2 rounded-lg border border-border/70 bg-card/40 p-2 sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="space-y-0.5" htmlFor="ql-sa-users-create-username">
            <span className="text-[11px] font-medium text-muted-foreground">
              Username
            </span>
            <input
              id="ql-sa-users-create-username"
              name="username"
              className={inputClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label className="space-y-0.5" htmlFor="ql-sa-users-create-email">
            <span className="text-[11px] font-medium text-muted-foreground">
              Email
            </span>
            <input
              id="ql-sa-users-create-email"
              name="email"
              className={inputClass}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="space-y-0.5" htmlFor="ql-sa-users-create-password">
            <span className="text-[11px] font-medium text-muted-foreground">
              Mật khẩu
            </span>
            <input
              id="ql-sa-users-create-password"
              name="password"
              className={inputClass}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="space-y-0.5" htmlFor="ql-sa-users-create-fullName">
            <span className="text-[11px] font-medium text-muted-foreground">
              Họ tên (profile)
            </span>
            <input
              id="ql-sa-users-create-fullName"
              name="fullName"
              className={inputClass}
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>
          <label className="space-y-0.5" htmlFor="ql-sa-users-create-typeId">
            <span className="text-[11px] font-medium text-muted-foreground">
              Vai trò (Type)
            </span>
            <select
              id="ql-sa-users-create-typeId"
              name="typeId"
              className={cn(inputClass, "py-1.5")}
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
            >
              <option value="">— Chọn —</option>
              {typesForCreate.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          {isSupplierCreateType ? (
            <fieldset className="space-y-1 rounded-lg border border-border/70 px-3 py-2 sm:col-span-2">
              <legend className="px-1 text-[11px] font-medium text-muted-foreground">
                Nhà cung cấp
              </legend>
              {isSupplierCatalogLoading ? (
                <p className="text-xs text-muted-foreground">Đang tải nhà cung cấp…</p>
              ) : isSupplierCatalogError ? (
                <p className="text-xs text-muted-foreground">
                  Không tải được danh sách nhà cung cấp.
                </p>
              ) : hasEmptySupplierCatalog ? (
                <p className="text-xs text-muted-foreground">Chưa có nhà cung cấp.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {suppliers.map((supplier) => {
                    const supplierId = Number(supplier.id);
                    return (
                      <label
                        key={supplier.id}
                        className="flex items-start gap-2 rounded-md border border-border/60 px-2 py-1.5 text-xs"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={supplierIds.includes(supplierId)}
                          onChange={() => setSupplierIds((current) => toggleSupplierId(current, supplierId))}
                        />
                        <span>{supplier.level1UnitName} — {supplier.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </fieldset>
          ) : (
            <label className="space-y-0.5" htmlFor="ql-sa-users-create-unitId">
              <span className="text-[11px] font-medium text-muted-foreground">
                Đơn vị
              </span>
              <select
                id="ql-sa-users-create-unitId"
                name="unitId"
                className={cn(inputClass, "py-1.5")}
                value={unitId}
                onChange={(e) => {
                  const next = e.target.value;
                  setUnitId(next);
                  const depth = sortedUnits.find((u) => String(u.id) === String(next))?.depth;
                  if (depth != null && depth !== 0) {
                    const adminType = types.find((t) => t.name === "admin");
                    if (adminType && String(typeId) === String(adminType.id)) {
                      setTypeId("");
                    }
                  }
                }}
              >
                <option value="">— Không gán —</option>
                {sortedUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {"—".repeat(unit.depth + 1)} {unit.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <Button
              type="submit"
              disabled={
                isCreating
                || (isSupplierCreateType && (isSupplierCatalogLoading || isSupplierCatalogError))
              }
              className="gap-1.5 px-3 py-1.5 text-xs"
              title="Tạo người dùng"
            >
              {isCreating ? (
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <UserPlus className="size-4 shrink-0" aria-hidden />
              )}
              <span>{isCreating ? "Đang tạo…" : "Tạo người dùng"}</span>
            </Button>
          </div>
        </form>

        {isLoading ? (
          <p className="shrink-0 text-xs text-muted-foreground">Đang tải…</p>
        ) : null}
        {isError ? (
          <p className="shrink-0 text-xs text-destructive">
            Không tải được danh sách (users.read).
          </p>
        ) : null}

        {!isLoading && !isError ? (
          isDesktop ? (
            <div className="min-w-0">
              <StickyResponsiveTable stickyLevel={1} className="border-border/70">
                <table className="w-full min-w-[560px] border-collapse text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-1.5 font-medium">Người dùng</th>
                      <th className="px-2 py-1.5 font-medium">Vai trò</th>
                      <th className="px-2 py-1.5 font-medium">Đơn vị</th>
                      <th className="px-2 py-1.5 font-medium">HT</th>
                      <th className="px-2 py-1.5 font-medium text-right">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr
                        key={u.id}
                        className="border-b border-border/60 hover:bg-secondary/20"
                      >
                        <td className="px-2 py-1.5">
                          <div className="font-medium">
                            {u.profile?.fullName || u.username}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {u.email}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 capitalize text-muted-foreground">
                          {u.type?.name ?? "—"}
                        </td>
                        <td className="max-w-[10rem] truncate px-2 py-1.5 text-muted-foreground">
                          {u.unit?.name ?? "—"}
                        </td>
                        <td className="px-2 py-1.5">{u.isActive ? "✓" : "—"}</td>
                        <td className="px-2 py-1.5 text-right">
                          <div className="flex justify-end gap-2">
                            {u.type?.name === "lttp_supplier" ? (
                              <Button
                                type="button"
                                variant="outline"
                                className="px-3 py-1.5 text-xs"
                                disabled={isPatching || loadingSupplierUserId != null}
                                onClick={() => openSupplierEditor(u)}
                              >
                                {loadingSupplierUserId === u.id ? "Đang tải…" : "Sửa nhà cung cấp"}
                              </Button>
                            ) : null}
                            <IconButton
                              label={u.isActive ? "Vô hiệu" : "Kích hoạt"}
                              variant={u.isActive ? "danger" : "primary"}
                              disabled={isPatching || togglingUserId != null || loadingSupplierUserId != null}
                              loading={togglingUserId === u.id}
                              onClick={() => toggleActive(u)}
                            >
                              <Power aria-hidden />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </StickyResponsiveTable>
            </div>
          ) : (
            <div className="space-y-0 px-3 sm:space-y-2 sm:px-0">
              {users.map((u) => (
                <article
                  key={u.id}
                  className="-mx-3 rounded-none border-x-0 border-y border-border/70 bg-card/40 p-3 shadow-sm first:border-t sm:mx-0 sm:rounded-xl sm:border sm:border-border/70"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {u.profile?.fullName || u.username}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <span
                      className="shrink-0 rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground"
                      aria-label={u.isActive ? "Đang hoạt động" : "Đã vô hiệu"}
                    >
                      {u.isActive ? "HT" : "—"}
                    </span>
                  </div>

                  <dl className="mt-2 space-y-1 text-[11px]">
                    <div className="flex gap-2">
                      <dt className="shrink-0 text-muted-foreground">Vai trò</dt>
                      <dd className="min-w-0 flex-1 text-right capitalize text-foreground">
                        {u.type?.name ?? "—"}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="shrink-0 text-muted-foreground">Đơn vị</dt>
                      <dd className="min-w-0 flex-1 truncate text-right text-foreground">
                        {u.unit?.name ?? "—"}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex justify-end gap-2 border-t border-border/60 pt-3">
                    {u.type?.name === "lttp_supplier" ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="px-3 py-1.5 text-xs"
                        disabled={isPatching || loadingSupplierUserId != null}
                        onClick={() => openSupplierEditor(u)}
                      >
                        {loadingSupplierUserId === u.id ? "Đang tải…" : "Sửa nhà cung cấp"}
                      </Button>
                    ) : null}
                    <IconButton
                      label={u.isActive ? "Vô hiệu" : "Kích hoạt"}
                      variant={u.isActive ? "danger" : "primary"}
                      disabled={isPatching || togglingUserId != null || loadingSupplierUserId != null}
                      loading={togglingUserId === u.id}
                      onClick={() => toggleActive(u)}
                    >
                      <Power aria-hidden />
                    </IconButton>
                  </div>
                </article>
              ))}
            </div>
          )
        ) : null}
      </CardContent>

      {editingSupplierUser ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-background/80 backdrop-blur-[1px]"
            aria-label="Đóng"
            onClick={closeSupplierEditor}
            disabled={savingSupplierUserId != null}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplier-editor-title"
            className="relative w-full max-w-lg rounded-t-2xl border border-border bg-card shadow-lg sm:rounded-2xl"
          >
            <div className="space-y-1 border-b border-border px-4 pb-3 pt-4 sm:px-5">
              <p
                id="supplier-editor-title"
                className="text-[10px] font-semibold uppercase tracking-wide text-primary"
              >
                Sửa nhà cung cấp
              </p>
              <p className="text-sm text-muted-foreground">
                Người dùng:{" "}
                <span className="font-medium text-foreground">
                  {editingSupplierUser.profile?.fullName || editingSupplierUser.username}
                </span>
              </p>
            </div>

            <div className="space-y-3 px-4 py-4 sm:px-5">
              {isSupplierCatalogLoading ? (
                <p className="text-sm text-muted-foreground">Đang tải nhà cung cấp…</p>
              ) : isSupplierCatalogError ? (
                <p className="text-sm text-muted-foreground">
                  Không tải được danh sách nhà cung cấp.
                </p>
              ) : hasEmptySupplierCatalog ? (
                <p className="text-sm text-muted-foreground">Chưa có nhà cung cấp.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {suppliers.map((supplier) => {
                    const supplierId = Number(supplier.id);
                    return (
                      <label
                        key={supplier.id}
                        className="flex items-start gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={editingSupplierIds.includes(supplierId)}
                          onChange={() =>
                            setEditingSupplierIds((current) => toggleSupplierId(current, supplierId))
                          }
                          disabled={savingSupplierUserId != null}
                        />
                        <span>{supplier.level1UnitName} — {supplier.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
              <Button
                type="button"
                variant="ghost"
                className="px-3 py-1.5 text-xs"
                disabled={savingSupplierUserId != null}
                onClick={closeSupplierEditor}
              >
                Huỷ
              </Button>
              <Button
                type="button"
                variant="primary"
                className="px-3 py-1.5 text-xs"
                disabled={
                  savingSupplierUserId != null ||
                  isSupplierCatalogLoading ||
                  isSupplierCatalogError ||
                  suppliers.length === 0
                }
                onClick={saveSupplierEditor}
              >
                {savingSupplierUserId != null ? "Đang lưu…" : "Lưu"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
