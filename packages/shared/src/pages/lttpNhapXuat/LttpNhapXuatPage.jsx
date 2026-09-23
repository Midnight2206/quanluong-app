"use client";

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useCurrentUser, useHasPermission } from "@/features/auth/model/authSlice";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import { useGetUnitsQuery } from "@/features/units/api/unitsApi";
import { TabPanel } from "@/components/common/TabPanel";
import { useSyncPersistedNavTabFromRoute, writePersistedNavTab } from "@/hooks/usePersistedNavTab";
import { cn } from "@/utils/cn";
import { LttpPhieuXuatTab } from "./LttpPhieuXuatTab";
import { LttpLichSuXuatTab } from "./LttpLichSuXuatTab";
import { LttpOrderingTab } from "./LttpOrderingTab";
import { LttpSignatureSettingsTab } from "./LttpSignatureSettingsTab";
import { LttpNguoiNhanBulkModal } from "./LttpNguoiNhanBulkModal";
import { LttpNguoiMuaBulkModal } from "./LttpNguoiMuaBulkModal";

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
  const canRead = useHasPermission(PERMISSIONS.LTTP_ISSUE_SLIPS_READ);
  const canWrite = useHasPermission(PERMISSIONS.LTTP_ISSUE_SLIPS_WRITE);
  const canPickUnits = useHasPermission(PERMISSIONS.UNITS_READ);

  const { data: unitsData } = useGetUnitsQuery(undefined, { skip: !canPickUnits });
  const units = unitsData ?? [];
  const sortedUnits = useMemo(() => sortUnitsByPath(units), [units]);

  /** Đơn vị cấp phát = đơn vị của user — không cho chọn / viết hộ cấp dưới. */
  const ownUnitId = user?.unit?.id != null ? Number(user.unit.id) : null;
  const effectiveUnitId = ownUnitId;

  const [bulkRecipientOpen, setBulkRecipientOpen] = useState(false);
  const [bulkBuyerOpen, setBulkBuyerOpen] = useState(false);
  const [editingSlip, setEditingSlip] = useState(null);
  const [tabRemountKey, setTabRemountKey] = useState(0);
  const [isToolbarCompact, setIsToolbarCompact] = useState(false);
  /** Đang rời /ordering-lttp → nhả forcedActiveTabId + dừng sync route ghi đè tab đích. */
  const [leavingOrderingRoute, setLeavingOrderingRoute] = useState(false);
  const toolbarSentinelRef = useRef(null);

  useEffect(() => {
    if (!orderingRouteForced) {
      setLeavingOrderingRoute(false);
    }
  }, [orderingRouteForced]);

  useEffect(() => {
    const sentinel = toolbarSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") {
      return undefined;
    }
    const scrollOwner = sentinel.closest("[data-page-scroll-owner]");
    const observer = new IntersectionObserver(
      ([entry]) => setIsToolbarCompact(!entry.isIntersecting),
      { root: scrollOwner, threshold: 0, rootMargin: "-1px 0px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [effectiveUnitId]);

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
        setLeavingOrderingRoute(false);
        if (!orderingRouteForced) {
          router.push(LTTP_ORDERING_ROUTE_PATH);
        }
        return;
      }
      // Từ /ordering-lttp → tab khác: ghi tab đích trước, nhả force, rồi mới đổi URL.
      // Không làm vậy thì forcedActiveTabId + sync route giữ ordering → phải bấm 2 lần.
      if (orderingRouteForced) {
        setLeavingOrderingRoute(true);
        writePersistedNavTab(LTTP_TAB_PERSIST_ID, id);
        router.push("/lttp-nhap-xuat");
      }
    },
    [router, orderingRouteForced],
  );

  useSyncPersistedNavTabFromRoute(
    LTTP_TAB_PERSIST_ID,
    ["phieu-xuat", "lich-su", LTTP_ORDER_TAB_ID],
    orderingRouteForced && !leavingOrderingRoute ? LTTP_ORDER_TAB_ID : undefined,
  );

  /** Danh sách đơn vị nhận / bulk config: nhánh của đơn vị user (không dùng để chọn kho viết phiếu). */
  const unitsInOwnSubtree = useMemo(() => {
    if (ownUnitId == null) {
      return [];
    }
    const rows = unitsWithinSubtree(sortedUnits, ownUnitId);
    const sorted = sortUnitsByPath(rows);
    if (sorted.length > 0) {
      return sorted;
    }
    return [{ id: ownUnitId, name: user?.unit?.name ?? `Đơn vị #${ownUnitId}` }];
  }, [ownUnitId, sortedUnits, user?.unit?.name]);

  const unitLabel = useMemo(() => {
    if (effectiveUnitId == null) {
      return null;
    }
    if (user?.unit?.id != null && Number(user.unit.id) === Number(effectiveUnitId)) {
      return user.unit.name ?? `#${effectiveUnitId}`;
    }
    return sortedUnits.find((u) => Number(u.id) === Number(effectiveUnitId))?.name ?? `#${effectiveUnitId}`;
  }, [effectiveUnitId, sortedUnits, user?.unit]);

  if (!canRead) {
    return (
      <p className="text-xs text-muted-foreground">
        Bạn chưa có quyền <span className="font-mono">lttp.issue-slips.read</span> — không thể mở Nhập xuất LTTP.
      </p>
    );
  }

  return (
    <section className="min-w-0 pb-6 print:hidden">
      {effectiveUnitId != null ? (
        <>
          <div ref={toolbarSentinelRef} className="h-px" aria-hidden />
          <div
            data-sticky-level="0"
            data-toolbar-compact={isToolbarCompact ? "true" : "false"}
            className={cn(
              "unified-sticky-surface mb-3 grid min-w-0 gap-3 rounded-xl border border-border/80 bg-background/95 shadow-sm transition-[padding,gap,border-radius] duration-200",
              isToolbarCompact
                ? "grid-cols-1 p-1.5 sm:p-2"
                : "p-3 sm:grid-cols-2 sm:items-end lg:grid-cols-[minmax(18rem,1fr)_auto]",
            )}
          >
            <div
              className={cn(
                "min-w-0 space-y-1",
                isToolbarCompact
                  ? "w-full sm:max-w-sm xl:max-w-md"
                  : "sm:col-span-2 lg:col-span-1 lg:max-w-md",
              )}
            >
              <p
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wide text-foreground",
                  isToolbarCompact && "sr-only",
                )}
              >
                Đơn vị cấp phát
              </p>
              <p
                className={cn(
                  "truncate rounded-lg border border-border/60 bg-muted/20 px-3 text-sm font-medium text-foreground",
                  isToolbarCompact ? "h-9 py-1.5 leading-6" : "min-h-10 py-2",
                )}
                title={unitLabel ?? undefined}
              >
                {unitLabel ?? `Đơn vị #${effectiveUnitId}`}
              </p>
            </div>
            {canWrite && !isToolbarCompact ? (
              <div className="grid w-full grid-cols-1 gap-2 sm:col-span-2 sm:grid-cols-2 lg:col-span-1 lg:w-auto">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-auto min-h-10 w-full gap-2 whitespace-normal px-3 py-2 text-xs leading-tight lg:w-auto xl:whitespace-nowrap"
                  onClick={() => setBulkBuyerOpen(true)}
                >
                  <Users className="size-3.5" />
                  Cài người mua theo đơn vị kho
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-auto min-h-10 w-full gap-2 whitespace-normal px-3 py-2 text-xs leading-tight lg:w-auto xl:whitespace-nowrap"
                  onClick={() => setBulkRecipientOpen(true)}
                >
                  <Users className="size-3.5" />
                  Cài người nhận theo đơn vị nhận
                </Button>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {canWrite ? (
        <>
          <LttpNguoiMuaBulkModal
            open={bulkBuyerOpen}
            onClose={() => setBulkBuyerOpen(false)}
            units={unitsInOwnSubtree}
            canWrite={canWrite}
          />
          <LttpNguoiNhanBulkModal
            open={bulkRecipientOpen}
            onClose={() => setBulkRecipientOpen(false)}
            units={unitsInOwnSubtree}
            canWrite={canWrite}
          />
        </>
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
              stickyTabListLevel={1}
              equalWidthTabs
              persistId={LTTP_TAB_PERSIST_ID}
              defaultTabId="phieu-xuat"
              forcedActiveTabId={
                orderingRouteForced && !leavingOrderingRoute ? LTTP_ORDER_TAB_ID : undefined
              }
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
                      units={unitsInOwnSubtree}
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
                      units={unitsInOwnSubtree}
                      canWrite={canWrite}
                      onRequestEdit={handleRequestEditSlip}
                    />
                  ),
                },
                {
                  id: "chu-ky",
                  label: "Cài đặt chữ ký",
                  panel: (
                    <LttpSignatureSettingsTab
                      unitId={effectiveUnitId}
                      canWrite={canWrite}
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
