"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useConfirm } from "@/contexts/ConfirmProvider";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import {
  useRestoreSystemBackupMutation,
  useRunSystemBackupMutation,
  useSystemBackupQuery,
} from "@/features/system-backup/api/systemBackupApi";
import { apiRequest } from "@/services/apiRequest";
import { notifyError, notifySuccess } from "@/services/notify";

function formatDay(iso) {
  const [y, m, d] = String(iso || "").split("-");
  if (!y || !m || !d) {
    return iso;
  }
  return `${d}/${m}/${y}`;
}

function formatBytes(n) {
  const v = Number(n) || 0;
  if (v <= 0) {
    return "—";
  }
  if (v < 1024 * 1024) {
    return `${Math.max(1, Math.round(v / 1024))} KB`;
  }
  return `${(v / (1024 * 1024)).toFixed(1)} MB`;
}

function partLabel(row) {
  const bits = [];
  if (row.db) bits.push("MariaDB");
  if (row.document) bits.push("Postgres chứng từ");
  if (row.qdrant) bits.push("Qdrant");
  if (row.media) bits.push("media");
  return bits.length ? bits.join(", ") : "thiếu file";
}

function isComplete(row) {
  return Boolean(row?.db && row?.document && row?.qdrant && row?.media);
}

export function SuperadminBackupPanel() {
  const user = useCurrentUser();
  const isSuperadmin = user?.type?.name === "superadmin";
  const { confirm } = useConfirm();
  const { data, isLoading, isError } = useSystemBackupQuery();
  const running = data?.status?.state === "running";
  const [restore, { isLoading: restoring }] = useRestoreSystemBackupMutation();
  const [runBackup, { isLoading: backingUp }] = useRunSystemBackupMutation();
  const [logLines, setLogLines] = useState(null);
  const [logLoading, setLogLoading] = useState(false);

  async function onRunBackup() {
    if (!isSuperadmin || backingUp) {
      return;
    }
    const ok = await confirm({
      title: "Chạy backup ngay",
      message:
        "Lệnh được xếp hàng. Container backup chạy trong vòng khoảng 20 giây. App vẫn chạy. Nếu lần backup trước chưa xong, lệnh này lỗi và có email.",
      confirmLabel: "Chạy backup",
      cancelLabel: "Huỷ",
    });
    if (!ok) {
      return;
    }
    try {
      await runBackup();
      notifySuccess("Đã nhận lệnh backup.");
    } catch (error) {
      notifyError(error?.data?.message || "Không gửi được lệnh backup.");
    }
  }

  async function onShowLog() {
    if (!isSuperadmin || logLoading) {
      return;
    }
    setLogLoading(true);
    try {
      const data = await apiRequest({ url: "/system-backup/log", method: "get" });
      setLogLines(Array.isArray(data?.lines) ? data.lines : []);
    } catch (error) {
      notifyError(error?.data?.message || "Không tải được log backup.");
    } finally {
      setLogLoading(false);
    }
  }

  async function onRestore(row) {
    if (!isComplete(row) || running || restoring) {
      return;
    }
    const ok = await confirm({
      title: `Khôi phục ngày ${formatDay(row.date)}`,
      message:
        "MariaDB, Postgres chứng từ, Qdrant và media sẽ được ghi lại bằng đúng bản ngày này. App vẫn chạy; trong lúc ghi, một số thao tác có thể lỗi rồi tự làm lại.",
      confirmLabel: "Khôi phục",
      cancelLabel: "Huỷ",
      variant: "danger",
    });
    if (!ok) {
      return;
    }
    try {
      await restore(row.date);
      notifySuccess("Đã nhận lệnh khôi phục.");
    } catch (error) {
      const message = error?.data?.message || "Không gửi được lệnh khôi phục.";
      notifyError(message);
    }
  }

  return (
    <Card className="shadow-soft">
      <CardContent className="space-y-3 !p-3 sm:!p-4">
        <div>
          <p className="text-sm font-medium">Backup dữ liệu</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Mỗi đêm 02:15 giữ 10 bản gần nhất trên Drive. Bấm một ngày để tạo lại toàn bộ dữ liệu của ngày đó.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            className="px-3 py-1.5 text-xs"
            disabled={!isSuperadmin || backingUp}
            onClick={onRunBackup}
          >
            {backingUp ? "Đang gửi" : "Chạy backup"}
          </Button>
          <Button
            variant="ghost"
            className="px-3 py-1.5 text-xs"
            disabled={!isSuperadmin || logLoading}
            onClick={onShowLog}
          >
            {logLoading ? "Đang tải" : "Xem log"}
          </Button>
        </div>
        {logLines ? (
          logLines.length === 0 ? (
            <p className="text-xs text-muted-foreground">Chưa có log.</p>
          ) : (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-border p-3 text-xs">
              {logLines.join("\n")}
            </pre>
          )
        ) : null}

        {data?.status?.message ? (
          <p className="text-xs text-foreground sm:text-sm">{data.status.message}</p>
        ) : null}
        {data?.mounted && data.driveReady === false ? (
          <p className="text-xs text-muted-foreground">
            Chưa có rclone.conf nên bản mới chỉ nằm trên máy, chưa lên Drive.
          </p>
        ) : null}

        {isLoading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Đang tải danh sách
          </p>
        ) : null}
        {isError ? (
          <p className="text-xs text-destructive">Không tải được danh sách backup.</p>
        ) : null}
        {!isLoading && !isError && data?.mounted === false ? (
          <p className="text-xs text-muted-foreground">{data.status?.message}</p>
        ) : null}
        {!isLoading && !isError && data?.mounted && (data.versions || []).length === 0 ? (
          <p className="text-xs text-muted-foreground">Chưa có bản backup.</p>
        ) : null}

        {(data?.versions || []).length > 0 ? (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {data.versions.map((row) => {
              const complete = isComplete(row);
              return (
                <li key={row.date} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left disabled:opacity-55"
                    disabled={!isSuperadmin || !complete || running || restoring}
                    onClick={() => onRestore(row)}
                  >
                    <span className="block text-sm font-medium">{formatDay(row.date)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {partLabel(row)} · {formatBytes(row.bytes)}
                    </span>
                  </button>
                  <Button
                    variant="dangerGhost"
                    className="px-3 py-1.5 text-xs"
                    disabled={!isSuperadmin || !complete || running || restoring}
                    onClick={() => onRestore(row)}
                  >
                    {running && data?.status?.date === row.date ? "Đang khôi phục" : "Khôi phục"}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
