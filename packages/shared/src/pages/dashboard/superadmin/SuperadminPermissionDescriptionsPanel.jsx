import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Card, CardContent } from "@/components/ui/Card";
import {
  useGetPermissionsCatalogQuery,
  usePatchPermissionDescriptionMutation,
} from "@/features/permissions/api/permissionsApi";
import { notifyError, notifySuccess } from "@/services/notify";
import { cn } from "@/utils/cn";

const textareaClass =
  "min-h-[3.5rem] w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

/** Cùng tham chiếm khi chưa có data — tránh `rows = []` mặc định (mảng mới mỗi render) → useEffect/[rows] lặp vô hạn. */
const EMPTY_ROWS = [];

export function SuperadminPermissionDescriptionsPanel() {
  const { data, isLoading, isError } = useGetPermissionsCatalogQuery();
  const rows = data ?? EMPTY_ROWS;
  const [patchDescription, { isLoading: saving }] = usePatchPermissionDescriptionMutation();
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    const next = {};
    for (const r of rows) {
      next[r.id] = r.description ?? "";
    }
    setDrafts(next);
  }, [rows]);

  const byModule = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const mod = r.module || "other";
      if (!map.has(mod)) {
        map.set(mod, []);
      }
      map.get(mod).push(r);
    }
    return map;
  }, [rows]);
  const moduleKeys = useMemo(() => [...byModule.keys()].sort(), [byModule]);

  async function onSave(row) {
    const raw = drafts[row.id] ?? "";
    const normalized = raw.trim() === "" ? null : raw;
    const previous = row.description ?? null;
    if (normalized === previous) {
      notifySuccess("Không có thay đổi.");
      return;
    }
    setSavingId(row.id);
    try {
      await patchDescription({ id: row.id, description: normalized }).unwrap();
      notifySuccess("Đã lưu mô tả quyền.");
    } catch (e) {
      notifyError(e?.data?.message || "Không lưu được.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Card className="shadow-soft flex min-h-0 flex-1 flex-col overflow-hidden">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 !p-3 sm:!p-4">
        <div>
          <p className="text-xs font-medium sm:text-sm">Mô tả quyền (dùng chung toàn hệ thống)</p>
          <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
            Mỗi quyền chỉ có <span className="font-medium text-foreground">một mô tả dùng chung</span> trong cơ sở dữ liệu — hiển thị
            giống nhau cho superadmin và admin (modal chức danh / API người dùng hiện tại). Đồng bộ khi khởi động backend điền tên và mô tả
            tiếng Việt từ catalog nếu ô đang trống; <span className="font-medium text-foreground">nội dung bạn đã lưu tại đây không bị ghi đè</span> khi deploy.
            Viết tiếng Việt nghiệp vụ, tránh thuật ngữ lập trình. Mã quyền và HTTP chỉ để tham chiếu nội bộ.
          </p>
        </div>

        {isError ? (
          <p className="text-xs text-destructive">Không tải được danh sách quyền. Hãy đăng nhập superadmin và thử lại.</p>
        ) : null}
        {isLoading ? <p className="text-xs text-muted-foreground">Đang tải…</p> : null}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain pr-1">
          {moduleKeys.map((mod) => (
            <div key={mod}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{mod}</p>
              <div className="space-y-3">
                {(byModule.get(mod) || []).map((row) => (
                  <div
                    key={row.id}
                    className={cn(
                      "rounded-xl border border-border/70 bg-card/80 px-3 py-3 sm:px-4",
                    )}
                  >
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:gap-4">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-semibold text-foreground">{row.name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{row.code}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {row.method} <span className="opacity-70">{row.pathRoute}</span>
                        </p>
                      </div>
                      <div className="min-w-0 flex-[1.4] space-y-2">
                        <label className="block" htmlFor={`ql-perm-desc-${row.id}`}>
                          <span className="mb-0.5 block text-[10px] font-medium text-muted-foreground">
                            Mô tả hiển thị cho admin
                          </span>
                          <textarea
                            id={`ql-perm-desc-${row.id}`}
                            name={`permissionDescription_${row.id}`}
                            className={textareaClass}
                            value={drafts[row.id] ?? ""}
                            onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                            placeholder="Ví dụ: Cho phép xem danh sách người dùng trong đơn vị của bạn."
                            maxLength={10000}
                          />
                        </label>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <IconButton
                            label="Hoàn tác"
                            variant="ghost"
                            disabled={saving}
                            onClick={() =>
                              setDrafts((d) => ({ ...d, [row.id]: row.description ?? "" }))
                            }
                          >
                            <RotateCcw aria-hidden />
                          </IconButton>
                          <IconButton
                            label="Lưu mô tả"
                            variant="primary"
                            disabled={saving}
                            loading={savingId === row.id && saving}
                            onClick={() => onSave(row)}
                          >
                            <Save aria-hidden />
                          </IconButton>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
