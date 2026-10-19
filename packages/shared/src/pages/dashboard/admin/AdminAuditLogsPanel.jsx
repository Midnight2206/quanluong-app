"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TabPanel } from "@/components/common/TabPanel";
import { useHasPermission } from "@/features/auth/model/authSlice";
import { PERMISSIONS } from "@/features/permissions/constants/permissions";
import {
  downloadAuditLogExcel,
  useAuditChangeDetailQuery,
  useAuditLogListQuery,
  useAuditLogUsersQuery,
} from "@/features/audit-logs/api/auditLogsApi";
import { notifyError } from "@/services/notify";
import { fieldClassSm } from "@/utils/fieldClass";
import { cn } from "@/utils/cn";

const AUTH_TYPES = {
  LOGIN_SUCCESS: ["Đăng nhập", "bg-success/15 text-success"],
  LOGIN_FAILED: ["Thất bại", "bg-destructive/15 text-destructive"],
  LOGOUT: ["Đăng xuất", "bg-muted text-muted-foreground"],
};
const FAIL_REASONS = {
  NOT_FOUND: "Không có tài khoản",
  BAD_PASSWORD: "Sai mật khẩu",
  NO_PASSWORD: "Chưa đặt mật khẩu",
  PENDING: "Chờ duyệt",
  REJECTED: "Bị từ chối",
  INACTIVE: "Bị khóa",
  UNVERIFIED: "Chưa xác minh email",
  RATE_LIMITED: "Quá nhiều lần thử",
  ERROR: "Lỗi",
};
const CHANGE_ACTIONS = {
  CREATE: ["Thêm", "bg-success/15 text-success"],
  UPDATE: ["Sửa", "bg-info/15 text-info"],
  DELETE: ["Xóa", "bg-destructive/15 text-destructive"],
};

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString("vi-VN") : "—");
const fmtDur = (sec) => {
  const s = Number(sec) || 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
};
const userLabel = (r) => (r.user ? r.user.fullName || r.user.username : r.identifier ? `(${r.identifier})` : "—");
const shortUa = (ua) => {
  if (!ua) return "—";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  const br = /Edg\//.test(ua) ? "Edge" : /Zalo/i.test(ua) ? "Zalo" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return [br, os].filter(Boolean).join(" · ") || ua.slice(0, 40);
};

function Badge({ map, value }) {
  const [label, cls] = map[value] ?? [value, "bg-muted text-muted-foreground"];
  return <span className={cn("inline-flex rounded px-1.5 py-0.5 text-xs font-medium", cls)}>{label}</span>;
}

function todayVn(offsetDays = 0) {
  const d = new Date(Date.now() + 7 * 3600000 - offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

const TABS = [
  {
    id: "auth",
    label: "Đăng nhập",
    typeOptions: [["", "Tất cả"], ...Object.entries(AUTH_TYPES).map(([k, [l]]) => [k, l])],
    typeParam: "type",
    columns: [
      ["Thời gian", (r) => <span className="tabular-nums">{fmtTime(r.occurredAt)}</span>],
      ["Người dùng", userLabel],
      ["Sự kiện", (r) => (
        <span className="inline-flex items-center gap-1.5">
          <Badge map={AUTH_TYPES} value={r.type} />
          {r.failReason ? <span className="text-xs text-muted-foreground">{FAIL_REASONS[r.failReason] ?? r.failReason}</span> : null}
        </span>
      )],
      ["Đơn vị", (r) => r.unitName ?? "—"],
      ["IP", (r) => <span className="tabular-nums">{r.ip ?? "—"}</span>],
      ["Thiết bị", (r) => <span title={r.userAgent ?? ""}>{shortUa(r.userAgent)}</span>],
    ],
  },
];

function ChangeDiff({ id, onClose }) {
  const { data, isLoading, isError } = useAuditChangeDetailQuery(id);
  const changes = data?.changes ?? {};
  const rows = data?.action === "UPDATE"
    ? Object.entries(changes).map(([k, v]) => [k, v?.from, v?.to])
    : Object.entries(changes).map(([k, v]) => (data?.action === "DELETE" ? [k, v, undefined] : [k, undefined, v]));
  const show = (v) => (v === undefined ? "" : v === null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{data ? `${data.modelLabel ?? data.model} #${data.recordId}` : "Đang tải…"}</p>
        <Button variant="ghost" className="px-3 py-1 text-xs" onClick={onClose}>Đóng</Button>
      </div>
      {isError ? <p className="text-xs text-destructive">Không tải được dữ liệu.</p> : null}
      {!isLoading && data ? (
        <div className="overflow-x-auto" data-local-scroll="true">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-1 pr-3 font-medium">Trường</th><th className="py-1 pr-3 font-medium">Trước</th><th className="py-1 font-medium">Sau</th></tr>
            </thead>
            <tbody>
              {rows.map(([k, a, b]) => (
                <tr key={k} className="border-t border-border/60 align-top">
                  <td className="py-1 pr-3 font-medium">{k}</td>
                  <td className="max-w-[24rem] break-words py-1 pr-3 text-muted-foreground">{show(a)}</td>
                  <td className="max-w-[24rem] break-words py-1">{show(b)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function LogTab({ tab }) {
  const canExport = useHasPermission(PERMISSIONS.AUDIT_LOGS_EXPORT);
  const users = useAuditLogUsersQuery();
  const [draft, setDraft] = useState({ userId: "", from: todayVn(7), to: todayVn(0), type: "" });
  const [filters, setFilters] = useState(draft);
  const [cursors, setCursors] = useState([undefined]);
  const [openId, setOpenId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const cursor = cursors[cursors.length - 1];
  const query = { userId: filters.userId, from: filters.from, to: filters.to, ...(tab.typeParam ? { [tab.typeParam]: filters.type } : {}) };
  const { data, isLoading, isError, isFetching } = useAuditLogListQuery(tab.id, query, cursor);
  const items = data?.items ?? [];

  useEffect(() => setOpenId(null), [filters, cursor]);

  const apply = (e) => {
    e.preventDefault();
    setFilters(draft);
    setCursors([undefined]);
  };
  const onExport = async () => {
    setExporting(true);
    try {
      await downloadAuditLogExcel(tab.id, query);
    } catch {
      notifyError("Không tải được file Excel.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={apply} className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Người dùng
          <select className={cn(fieldClassSm, "w-48")} value={draft.userId} onChange={(e) => setDraft({ ...draft, userId: e.target.value })}>
            <option value="">Tất cả</option>
            {(users.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>{u.fullName ? `${u.fullName} (${u.username})` : u.username}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Từ ngày
          <input type="date" className={cn(fieldClassSm, "w-36")} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Đến ngày
          <input type="date" className={cn(fieldClassSm, "w-36")} value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        </label>
        {tab.typeOptions ? (
          <label className="grid gap-1 text-xs text-muted-foreground">
            Loại
            <select className={cn(fieldClassSm, "w-40")} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
              {tab.typeOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        ) : null}
        <Button type="submit" className="px-3 py-1.5 text-sm">Lọc</Button>
        {canExport && tab.exportable !== false ? (
          <Button variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm" onClick={onExport} disabled={exporting}>
            {exporting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
            Excel
          </Button>
        ) : null}
      </form>

      {openId ? <ChangeDiff id={openId} onClose={() => setOpenId(null)} /> : null}

      <div className="overflow-x-auto rounded-lg border border-border" data-local-scroll="true">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>{tab.columns.map(([h]) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr
                key={r.id}
                className={cn("border-t border-border/60", tab.rowClick && "cursor-pointer hover:bg-muted/40")}
                onClick={tab.rowClick ? () => setOpenId(r.id) : undefined}
              >
                {tab.columns.map(([h, render]) => <td key={h} className="px-3 py-1.5 align-top">{render(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {isLoading ? <p className="px-3 py-3 text-xs text-muted-foreground">Đang tải…</p> : null}
        {isError ? <p className="px-3 py-3 text-xs text-destructive">Không tải được dữ liệu.</p> : null}
        {!isLoading && !isError && !items.length ? <p className="px-3 py-3 text-xs text-muted-foreground">Không có dữ liệu.</p> : null}
      </div>

      <div className="flex items-center justify-end gap-2">
        {isFetching && !isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden /> : null}
        <Button variant="ghost" className="px-3 py-1 text-xs" disabled={cursors.length <= 1} onClick={() => setCursors(cursors.slice(0, -1))}>Trước</Button>
        <Button variant="ghost" className="px-3 py-1 text-xs" disabled={!data?.nextCursor} onClick={() => setCursors([...cursors, data.nextCursor])}>Sau</Button>
      </div>
    </div>
  );
}

export function AdminAuditLogsPanel() {
  return (
    <Card className="border-border/80">
      <CardContent className="space-y-2 !p-3 sm:!p-4">
        <TabPanel
          persistId="dashboard.auditLogs"
          tabs={TABS.map((t) => ({ id: t.id, label: t.label, panel: <LogTab key={t.id} tab={t} /> }))}
        />
      </CardContent>
    </Card>
  );
}

export { CHANGE_ACTIONS, fmtDur };
