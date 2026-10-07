"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useConfirm } from "@/contexts/ConfirmProvider";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import {
  useRestartContainerMutation,
  useSystemInfraQuery,
} from "@/features/system-infra/api/systemInfraApi";
import { notifyError, notifySuccess } from "@/services/notify";

const STATUS_CLASS = {
  ok: "text-emerald-700 dark:text-emerald-300",
  warn: "text-amber-700 dark:text-amber-300",
  down: "text-destructive",
  unknown: "text-muted-foreground",
};

function StatusLine({ name, status, message }) {
  return (
    <li className="flex items-baseline justify-between gap-3 px-3 py-2">
      <span className="text-sm">{name}</span>
      <span className={`text-right text-xs ${STATUS_CLASS[status] || STATUS_CLASS.unknown}`}>
        {message}
      </span>
    </li>
  );
}

function ContainerRow({ row, onRestart, restarting, showRestart }) {
  return (
    <li className="flex items-baseline justify-between gap-3 px-3 py-2">
      <span className="text-sm">{row.name}</span>
      <span className="flex items-center gap-2">
        {showRestart && row.name !== "quanluong-backup" ? (
          <Button
            variant="dangerGhost"
            className="px-3 py-1.5 text-xs"
            disabled={restarting}
            onClick={() => onRestart(row.name)}
          >
            Restart
          </Button>
        ) : null}
        <span className={`text-right text-xs ${STATUS_CLASS[row.status] || STATUS_CLASS.unknown}`}>
          {row.message}
        </span>
      </span>
    </li>
  );
}

export function SuperadminInfraPanel() {
  const user = useCurrentUser();
  const isSuperadmin = user?.type?.name === "superadmin";
  const { confirm } = useConfirm();
  const { data, isLoading, isError } = useSystemInfraQuery();
  const [restart, { isLoading: restarting }] = useRestartContainerMutation();

  async function onRestart(name) {
    const ok = await confirm({
      title: `Restart ${name}`,
      message: "Site có thể ngắt một lúc.",
      confirmLabel: "Restart",
      cancelLabel: "Huỷ",
      variant: "danger",
    });
    if (!ok) {
      return;
    }
    try {
      await restart(name);
      notifySuccess("Đã nhận lệnh restart.");
    } catch (error) {
      notifyError(error?.data?.message || "Không restart được container.");
    }
  }

  return (
    <Card className="shadow-soft">
      <CardContent className="space-y-3 !p-3 sm:!p-4">
        <div>
          <p className="text-sm font-medium">Hạ tầng</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Đĩa máy chủ, backup đêm lúc 02:15, và container đang chạy. Trang tự tải lại mỗi 30 giây.
          </p>
        </div>
        {isLoading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Đang kiểm tra
          </p>
        ) : null}
        {isError ? <p className="text-xs text-destructive">Không tải được tình trạng hạ tầng.</p> : null}
        {data ? (
          <ul className="divide-y divide-border rounded-xl border border-border">
            <StatusLine name="Đĩa" status={data.disk?.status} message={data.disk?.message} />
            <StatusLine name="Backup đêm" status={data.backup?.status} message={data.backup?.message} />
            {(data.containers || []).map((row) => (
              <ContainerRow
                key={row.name}
                row={row}
                onRestart={onRestart}
                restarting={restarting}
                showRestart={isSuperadmin}
              />
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
