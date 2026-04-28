"use client";

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useCurrentUser, useHasPermission } from "@/features/auth/model/authSlice";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import { useGetUnitsQuery } from "@/features/units/api/unitsApi";
import { useTargetUnitScope } from "@/contexts/TargetUnitScopeContext";
import { TabPanel } from "@/components/common/TabPanel";
import { useSyncPersistedNavTabFromRoute, writePersistedNavTab } from "@/hooks/usePersistedNavTab";
import { LttpPhieuXuatTab } from "./LttpPhieuXuatTab";
import { LttpLichSuXuatTab } from "./LttpLichSuXuatTab";
import { LttpOrderingTab } from "./LttpOrderingTab";
import { LttpNguoiNhanBulkModal } from "./LttpNguoiNhanBulkModal";
import { readStoredManualUnitId, writeStoredManualUnitId } from "./lttpNhapXuatSessionPersist";

const LTTP_TAB_PERSIST_ID = "lttp-nhap-xuat";
/** Khớp thư mục `app/.../lttp-nhap-xuat/ordering-lttp/` */
const LTTP_ORDER_TAB_ID = "ordering-lttp";
const LTTP_ORDERING_ROUTE_PATH = "/lttp-nhap-xuat/ordering-lttp";

function sortUnitsByPath(units) {
  return [...(units || [])].sort((a, b) => (a.path || "").localeCompare(b.path || ""));
}

/** Khớp `getSubtreeUnitIds` BE: gốc + mọi đơn vị có `path` bắt đầu bằng prefix của path gốc */
function normalizePathPrefix(path) {
  if (!path) return "";
  return path.endsWith("/") ? path : `${path}/`;
}

function unitsWithinSubtree(allUnits, rootId) {
  if (rootId == null || !allUnits?.length) return [];
  const root = allUnits.find((u) => Number(u.id) === Number(rootId));
  if (!root) {
    return [{ id: rootId, name: `Đơn vị #${rootId}` }];
  }
  const pref = normalizePathPrefix(root.path || "");
  if (!pref) {
    return allUnits.filter((u) => Number(u.id) === Number(rootId));
  }
  return allUnits.filter(
    (u) =>
      Number(u.id) === Number(rootId) ||
      (typeof u.path === "string" && u.path.startsWith(pref)),
  );
}

export function LttpNhapXuatPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const orderingRouteForced =
    pathname === LTTP_ORDERING_ROUTE_PATH || pathname.endsWith(`/ordering-lttp`);

  const user = useCurrentUser();
  const { workingUnitId, isPrivileged } = useTargetUnitScope();
  const canRead = useHasPermission(PERMISSIONS.LTTP_ISSUE_SLIPS_READ);
  const canWrite = useHasPermission(PERMISSIONS.LTTP_ISSUE_SLIPS_WRITE);
  const canPickUnits = useHasPermission(PERMISSIONS.UNITS_READ);

  const { data: unitsData } = useGetUnitsQuery(undefined, { skip: !canPickUnits });
  const units = unitsData ?? [];
  const sortedUnits = useMemo(() => sortUnitsByPath(units), [units]);

  const defaultUnitId = user?.unit?.id != null ? Number(user.unit.id) : null;

  const selectedUnitId = useMemo(() => {
    if (!canPickUnits) {
      return defaultUnitId;
    }
    if (workingUnitId != null) {
      return Number(workingUnitId);
    }
    /**
     * User thường: mặc định kho = đơn vị gốc tài khoản — không fallback `sortedUnits[0]` (tránh lệch nhánh).
     * Phạm vi API là SUBTREE (nhánh con); chọn kho con qua manualUnitId / session.
     */
    if (!isPrivileged && defaultUnitId != null) {
      return defaultUnitId;
    }
    if (sortedUnits.length) {
      return sortedUnits[0].id;
    }
    return defaultUnitId;
  }, [canPickUnits, defaultUnitId, isPrivileged, workingUnitId, sortedUnits]);

  const [manualUnitId, setManualUnitId] = useState(null);
  const [bulkRecipientOpen, setBulkRecipientOpen] = useState(false);
  const [editingSlip, setEditingSlip] = useState(null);
  const [tabRemountKey, setTabRemountKey] = useState(0);

  const didRestoreManualUnitRef = useRef(false);
  useEffect(() => {
    didRestoreManualUnitRef.current = false;
  }, [user?.id]);

  /** Khôi phục nháp kho từ session nếu id vẫn nằm trong phạm vi (toàn tree hoặc nhánh user). */
  useEffect(() => {
    if (!canPickUnits || !sortedUnits.length || didRestoreManualUnitRef.current) {
      return;
    }
    didRestoreManualUnitRef.current = true;
    const allowed =
      !isPrivileged && defaultUnitId != null
        ? unitsWithinSubtree(sortedUnits, defaultUnitId)
        : sortedUnits;
    const allowedIds = new Set(allowed.map((u) => Number(u.id)));
    const stored = readStoredManualUnitId();
    if (stored != null && allowedIds.has(Number(stored))) {
      setManualUnitId(stored);
    }
  }, [canPickUnits, sortedUnits, isPrivileged, defaultUnitId]);

  useEffect(() => {
    setManualUnitId(null);
    writeStoredManualUnitId(null);
    setEditingSlip(null);
  }, [workingUnitId]);

  const persistManualUnitId = useCallback((next) => {
    setManualUnitId(next);
    writeStoredManualUnitId(next);
  }, []);

  const handleRequestEditSlip = useCallback((slip) => {
    if (!slip) {
      return;
    }
    writePersistedNavTab(LTTP_TAB_PERSIST_ID, "phieu-xuat");
    setEditingSlip(slip);
    setTabRemountKey((k) => k + 1);
  }, []);

  const handleCancelEditSlip = useCallback(() => {
    writePersistedNavTab(LTTP_TAB_PERSIST_ID, "lich-su");
    setEditingSlip(null);
    setTabRemountKey((k) => k + 1);
  }, []);

  const handleNhapXuatTabNavigate = useCallback(
    (id) => {
      if (id === LTTP_ORDER_TAB_ID) {
        router.push(LTTP_ORDERING_ROUTE_PATH);
        return;
      }
      router.push("/lttp-nhap-xuat");
    },
    [router],
  );

  useSyncPersistedNavTabFromRoute(
    LTTP_TAB_PERSIST_ID,
    ["phieu-xuat", "lich-su", LTTP_ORDER_TAB_ID],
    orderingRouteForced ? LTTP_ORDER_TAB_ID : undefined,
  );

  const effectiveUnitId = useMemo(() => manualUnitId ?? selectedUnitId, [manualUnitId, selectedUnitId]);

  /** Dropdown kho: user thường chỉ các đơn vị trong nhánh (path) của đơn vị gốc — khớp scope SUBTREE API. */
  const unitsForKhoDropdown = useMemo(() => {
    if (!isPrivileged && defaultUnitId != null) {
      const rows = unitsWithinSubtree(sortedUnits, defaultUnitId);
      const sorted = sortUnitsByPath(rows);
      if (sorted.length > 0) {
        return sorted;
      }
      return [{ id: defaultUnitId, name: user?.unit?.name ?? `Đơn vị #${defaultUnitId}` }];
    }
    return sortedUnits;
  }, [defaultUnitId, isPrivileged, sortedUnits, user?.unit?.name]);

  const unitLabel = useMemo(() => {
    if (effectiveUnitId == null) {
      return null;
    }
    if (!canPickUnits && user?.unit?.id != null && Number(user.unit.id) === Number(effectiveUnitId)) {
      return user.unit.name ?? `#${effectiveUnitId}`;
    }
    return sortedUnits.find((u) => Number(u.id) === Number(effectiveUnitId))?.name ?? `#${effectiveUnitId}`;
  }, [canPickUnits, effectiveUnitId, sortedUnits, user?.unit]);

  if (!canRead) {
    return (
      <p className="text-xs text-muted-foreground">
        Bạn chưa có quyền <span className="font-mono">lttp.issue-slips.read</span> — không thể mở Nhập xuất LTTP.
      </p>
    );
  }

  return (
    <section className="min-w-0 pb-6 print:hidden">
      <div className="mb-2 space-y-0.5">
        <h1 className="text-base font-semibold tracking-tight sm:text-lg">Nhập xuất LTTP</h1>
        <p className="text-[11px] text-muted-foreground">
          Chọn kho cấp phát — tab Phiếu xuất, Lịch sử xuất kho, hoặc Đặt hàng (tổng hợp phiếu trong ngày; có đường dẫn riêng{" "}
          <span className="font-mono text-[10px]">…/ordering-lttp</span> để chia sẻ và in).
        </p>
      </div>

      {canPickUnits && unitsForKhoDropdown.length > 0 && effectiveUnitId != null ? (
        <div className="mb-3 flex flex-col gap-3 rounded-xl border border-border/80 bg-card/40 p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <label className="min-w-0 flex-1 space-y-1 sm:max-w-md" htmlFor="lttp-io-unit">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">Đơn vị cấp phát (kho dữ liệu)</span>
            <select
              id="lttp-io-unit"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium outline-none focus:border-primary"
              value={String(effectiveUnitId ?? "")}
              onChange={(e) => {
                const v = e.target.value;
                persistManualUnitId(v === "" ? null : Number(v));
              }}
            >
              {unitsForKhoDropdown.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? `Đơn vị #${u.id}`}
                </option>
              ))}
            </select>
          </label>
          {canWrite ? (
            <Button
              type="button"
              variant="secondary"
              className="h-9 w-full gap-2 text-xs sm:w-auto"
              onClick={() => setBulkRecipientOpen(true)}
            >
              <Users className="size-3.5" />
              Cài người nhận theo đơn vị nhận
            </Button>
          ) : null}
        </div>
      ) : null}

      {canWrite ? (
        <LttpNguoiNhanBulkModal
          open={bulkRecipientOpen}
          onClose={() => setBulkRecipientOpen(false)}
          units={unitsForKhoDropdown}
          canWrite={canWrite}
        />
      ) : null}

      <Card className="shadow-soft">
        <CardContent className="!p-3 sm:!p-4">
          {effectiveUnitId == null ? (
            <p className="text-xs text-destructive">Chưa có đơn vị làm việc — gán đơn vị cho tài khoản.</p>
          ) : (
            <TabPanel
              key={tabRemountKey}
              scrollablePanel={false}
              stickyTabList
              equalWidthTabs
              persistId={LTTP_TAB_PERSIST_ID}
              defaultTabId="phieu-xuat"
              forcedActiveTabId={orderingRouteForced ? LTTP_ORDER_TAB_ID : undefined}
              onTabSelect={handleNhapXuatTabNavigate}
              tabs={[
                {
                  id: "phieu-xuat",
                  label: "Phiếu xuất",
                  panel: (
                    <LttpPhieuXuatTab
                      key={editingSlip ? `edit-${editingSlip.id}` : "create"}
                      selectedUnitId={effectiveUnitId}
                      canWrite={canWrite}
                      unitLabel={unitLabel}
                      units={unitsForKhoDropdown}
                      canPickUnits={canPickUnits}
                      editingSlip={editingSlip}
                      onCancelEdit={handleCancelEditSlip}
                      onUpdated={handleCancelEditSlip}
                    />
                  ),
                },
                {
                  id: "lich-su",
                  label: "Lịch sử xuất kho",
                  panel: (
                    <LttpLichSuXuatTab
                      storageUnitId={effectiveUnitId}
                      storageUnitName={unitLabel}
                      units={unitsForKhoDropdown}
                      canWrite={canWrite}
                      onRequestEdit={handleRequestEditSlip}
                    />
                  ),
                },
                {
                  id: LTTP_ORDER_TAB_ID,
                  label: "Đặt hàng",
                  panel: (
                    <LttpOrderingTab effectiveUnitId={effectiveUnitId} storageUnitName={unitLabel ?? ""} />
                  ),
                },
              ]}
            />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
