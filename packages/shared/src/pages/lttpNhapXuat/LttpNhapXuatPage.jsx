"use client";

import { useMemo, useState, useEffect } from "react";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useCurrentUser, useHasPermission } from "@/features/auth/model/authSlice";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import { useGetUnitsQuery } from "@/features/units/api/unitsApi";
import { useTargetUnitScope } from "@/contexts/TargetUnitScopeContext";
import { TabPanel } from "@/components/common/TabPanel";
import { LttpPhieuXuatTab } from "./LttpPhieuXuatTab";
import { LttpLichSuXuatTab } from "./LttpLichSuXuatTab";
import { LttpNguoiNhanBulkModal } from "./LttpNguoiNhanBulkModal";

function sortUnitsByPath(units) {
  return [...(units || [])].sort((a, b) => (a.path || "").localeCompare(b.path || ""));
}

export function LttpNhapXuatPage() {
  const user = useCurrentUser();
  const { workingUnitId } = useTargetUnitScope();
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
    if (sortedUnits.length) {
      return sortedUnits[0].id;
    }
    return defaultUnitId;
  }, [canPickUnits, defaultUnitId, workingUnitId, sortedUnits]);

  const [manualUnitId, setManualUnitId] = useState(null);
  const [bulkRecipientOpen, setBulkRecipientOpen] = useState(false);
  useEffect(() => {
    setManualUnitId(null);
  }, [workingUnitId]);

  const effectiveUnitId = manualUnitId ?? selectedUnitId;

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
        <p className="text-[11px] text-muted-foreground">Chọn kho cấp phát bên dưới, lập phiếu ở tab Phiếu xuất; lịch sử và in hàng loạt ở tab tương ứng.</p>
      </div>

      {canPickUnits && sortedUnits.length > 0 && effectiveUnitId != null ? (
        <div className="mb-3 flex flex-col gap-3 rounded-xl border border-border/80 bg-card/40 p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <label className="min-w-0 flex-1 space-y-1 sm:max-w-md" htmlFor="lttp-io-unit">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">Đơn vị cấp phát (kho dữ liệu)</span>
            <select
              id="lttp-io-unit"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium outline-none focus:border-primary"
              value={String(effectiveUnitId ?? "")}
              onChange={(e) => {
                const v = e.target.value;
                setManualUnitId(v === "" ? null : Number(v));
              }}
            >
              {sortedUnits.map((u) => (
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
          units={sortedUnits}
          canWrite={canWrite}
        />
      ) : null}

      <Card className="shadow-soft">
        <CardContent className="!p-3 sm:!p-4">
          {effectiveUnitId == null ? (
            <p className="text-xs text-destructive">Chưa có đơn vị làm việc — gán đơn vị cho tài khoản.</p>
          ) : (
            <TabPanel
              scrollablePanel={false}
              stickyTabList
              equalWidthTabs
              persistId="lttp-nhap-xuat"
              defaultTabId="phieu-xuat"
              tabs={[
                {
                  id: "phieu-xuat",
                  label: "Phiếu xuất",
                  panel: (
                    <LttpPhieuXuatTab
                      selectedUnitId={effectiveUnitId}
                      canWrite={canWrite}
                      unitLabel={unitLabel}
                      units={sortedUnits}
                      canPickUnits={canPickUnits}
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
                      units={sortedUnits}
                      canWrite={canWrite}
                    />
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
