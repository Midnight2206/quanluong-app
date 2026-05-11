import { Building2 } from "lucide-react";
import { useMemo } from "react";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import { useTargetUnitScope } from "@/contexts/TargetUnitScopeContext";
import { cn } from "@/utils/cn";
import { formatUnitOptionLabel, sortUnitsByMaterializedPath } from "@/utils/unitTreeFlatSelect";

const selectClass =
  "max-w-[min(100%,28rem)] min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

export function WorkingUnitScopeBar() {
  const user = useCurrentUser();
  const { isPrivileged, flatUnits, flatLoading, workingUnitId, setWorkingUnitId } = useTargetUnitScope();

  const sorted = useMemo(() => sortUnitsByMaterializedPath(flatUnits), [flatUnits]);

  if (!user || !isPrivileged) {
    return null;
  }

  if (sorted.length <= 1) {
    return null;
  }

  const value = workingUnitId != null ? String(workingUnitId) : "";

  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-2 border-b border-border/80 bg-muted/30 px-3 py-2 print:hidden sm:px-4",
      )}
    >
      <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <Building2 className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden text-[11px] font-medium sm:inline sm:text-xs">Đơn vị đang xem</span>
      </div>
      <select
        id="working-unit-scope"
        name="working-unit-scope"
        className={selectClass}
        value={value}
        disabled={flatLoading}
        onChange={(e) => {
          const v = e.target.value;
          setWorkingUnitId(v === "" ? null : v);
        }}
        aria-label="Chọn đơn vị để lọc dữ liệu cấp dưới"
      >
        <option value="">Toàn bộ nhánh được phép</option>
        {sorted.map((u) => (
          <option key={u.id} value={String(u.id)}>
            {formatUnitOptionLabel(u)}
          </option>
        ))}
      </select>
      {flatLoading ? (
        <span className="text-[10px] text-muted-foreground">Đang tải danh sách…</span>
      ) : null}
    </div>
  );
}
