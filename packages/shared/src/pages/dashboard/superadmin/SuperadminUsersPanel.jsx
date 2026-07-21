import { useMemo, useState } from "react";
import { Loader2, Power, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Card, CardContent } from "@/components/ui/Card";
import { StickyResponsiveTable } from "@/components/common/StickyHorizontalTable";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { DashboardUserRowCard } from "@/pages/dashboard/components/DashboardUserRowCard";
import { useGetTypesQuery } from "@/features/types/api/typesApi";
import { useGetUnitsQuery } from "@/features/units/api/unitsApi";
import {
  useCreateUserMutation,
  useGetUsersQuery,
  usePatchUserMutation,
} from "@/features/users/api/usersApi";
import { cn } from "@/utils/cn";
import { notifyError, notifySuccess } from "@/services/notify";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

function sortUnitsByPath(units) {
  return [...units].sort((a, b) => (a.path || "").localeCompare(b.path || ""));
}

export function SuperadminUsersPanel() {
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

  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [patchUser, { isLoading: isPatching }] = usePatchUserMutation();
  const [togglingUserId, setTogglingUserId] = useState(null);

  async function onCreateUser(e) {
    e.preventDefault();
    if (
      !username.trim() ||
      !email.trim() ||
      password.length < 8 ||
      !fullName.trim() ||
      !typeId
    ) {
      notifyError("Điền đủ: username, email, mật khẩu (≥8), họ tên, vai trò.");
      return;
    }
    try {
      await createUser({
        username: username.trim(),
        email: email.trim(),
        password,
        typeId: Number(typeId),
        unitId: unitId ? Number(unitId) : null,
        profile: { fullName: fullName.trim() },
      }).unwrap();
      notifySuccess("Đã tạo người dùng.");
      setUsername("");
      setEmail("");
      setPassword("");
      setFullName("");
      setTypeId("");
      setUnitId("");
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

  return (
    <Card className="shadow-soft min-w-0">
      <CardContent className="min-w-0 space-y-3 !p-3 sm:!p-4">
        <form
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
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <Button
              type="submit"
              disabled={isCreating}
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
                          <IconButton
                            label={u.isActive ? "Vô hiệu" : "Kích hoạt"}
                            variant={u.isActive ? "danger" : "primary"}
                            disabled={isPatching || togglingUserId != null}
                            loading={togglingUserId === u.id}
                            onClick={() => toggleActive(u)}
                          >
                            <Power aria-hidden />
                          </IconButton>
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
                <DashboardUserRowCard
                  key={u.id}
                  user={u}
                  isPatching={isPatching}
                  togglingUserId={togglingUserId}
                  onToggleActive={toggleActive}
                />
              ))}
            </div>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
