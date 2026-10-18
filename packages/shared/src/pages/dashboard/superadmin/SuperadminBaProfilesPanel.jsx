"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import { useBaLatestProfilesQuery, useBaProfileQuery } from "@/features/ba-profiles/api/baProfilesApi";
import { BaTokenManager } from "@/features/ba-profiles/components/BaTokenManager";

function fmt(iso) {
  return iso ? new Date(iso).toLocaleString("vi-VN") : "—";
}

function ProfileViewer({ id, onClose }) {
  const { data, isLoading, isError } = useBaProfileQuery(id);
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {data ? `${data.unitName} · v${data.version} · ${data.title}` : "Đang tải…"}
        </p>
        <Button variant="ghost" className="px-3 py-1 text-xs" onClick={onClose}>
          Đóng
        </Button>
      </div>
      {isError ? <p className="text-xs text-destructive">Không tải được hồ sơ.</p> : null}
      {!isLoading && data ? (
        <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded bg-muted/50 p-3 text-xs">
          {data.contentMarkdown}
        </pre>
      ) : null}
    </div>
  );
}

export function SuperadminBaProfilesPanel() {
  const user = useCurrentUser();
  const isSuperadmin = user?.type?.name === "superadmin";
  const { data, isLoading, isError } = useBaLatestProfilesQuery(isSuperadmin);
  const [openId, setOpenId] = useState(null);
  const rows = Array.isArray(data) ? data : [];

  if (!isSuperadmin) {
    return <p className="text-sm text-muted-foreground">Chỉ superadmin xem trang này.</p>;
  }

  return (
    <div className="space-y-3">
      <Card className="shadow-soft">
        <CardContent className="space-y-3 !p-3 sm:!p-4">
          <div>
            <p className="text-sm font-medium">Hồ sơ nghiệp vụ đơn vị</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Bản mới nhất mỗi đơn vị do trợ lý BA đẩy lên qua API <code>/api/ba/unit-profiles</code>.
            </p>
          </div>
          {isLoading ? <p className="text-xs text-muted-foreground">Đang tải…</p> : null}
          {isError ? <p className="text-xs text-destructive">Không tải được danh sách.</p> : null}
          {!isLoading && !rows.length ? <p className="text-xs text-muted-foreground">Chưa có hồ sơ.</p> : null}
          {rows.length ? (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60"
                    onClick={() => setOpenId(r.id)}
                  >
                    <span>
                      <b>{r.unitName}</b> · {r.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      v{r.version} · {r.schemaVersion} · {fmt(r.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {openId ? <ProfileViewer id={openId} onClose={() => setOpenId(null)} /> : null}
        </CardContent>
      </Card>
      <Card className="shadow-soft">
        <CardContent className="space-y-3 !p-3 sm:!p-4">
          <p className="text-sm font-medium">Mã khóa đọc toàn bộ (GLOBAL_READ)</p>
          <BaTokenManager scope="GLOBAL_READ" />
        </CardContent>
      </Card>
    </div>
  );
}
