"use client";

import { useEffect, useState } from "react";
import { Download, Eye, Loader2, X } from "lucide-react";
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
  useAuditUsagePagesQuery,
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
const ZALO_REASONS = { DENIED: "Từ chối cấp quyền", STATE: "Phiên không hợp lệ", PENDING: "Chờ duyệt" };
const failReasonLabel = (code) => {
  if (code?.startsWith("ZALO_")) return `Zalo: ${ZALO_REASONS[code.slice(5)] ?? code.slice(5).toLowerCase()}`;
  return FAIL_REASONS[code] ?? code;
};
const USAGE_SOURCES = { web: "Web", supplier: "Nhà cung cấp" };
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
          {r.failReason ? <span className="text-xs text-muted-foreground">{failReasonLabel(r.failReason)}</span> : null}
        </span>
      )],
      ["Đơn vị", (r) => r.unitName ?? "—"],
      ["IP", (r) => <span className="tabular-nums">{r.ip ?? "—"}</span>],
      ["Thiết bị", (r) => <span title={r.userAgent ?? ""}>{shortUa(r.userAgent)}</span>],
    ],
  },
  {
    id: "changes",
    label: "Thay đổi dữ liệu",
    typeOptions: [["", "Tất cả"], ...Object.entries(CHANGE_ACTIONS).map(([k, [l]]) => [k, l])],
    typeParam: "action",
    rowClick: true,
    columns: [
      ["Thời gian", (r) => <span className="tabular-nums">{fmtTime(r.occurredAt)}</span>],
      ["Người dùng", (r) => (r.user ? r.user.fullName || r.user.username : "Hệ thống")],
      ["Thao tác", (r) => <Badge map={CHANGE_ACTIONS} value={r.action} />],
      ["Đối tượng", (r) => r.modelLabel ?? r.model],
      ["Mã bản ghi", (r) => <span className="tabular-nums">{r.recordId ?? "—"}</span>],
      ["Đơn vị", (r) => r.unitName ?? "—"],
    ],
  },
  {
    id: "usage",
    label: "Sử dụng",
    rowClick: true,
    typeLabel: "Ứng dụng",
    typeOptions: [["", "Tất cả"], ...Object.entries(USAGE_SOURCES)],
    typeParam: "source",
    columns: [
      ["Ngày", (r) => <span className="tabular-nums">{r.day}</span>],
      ["Người dùng", (r) => (r.user ? r.user.fullName || r.user.username : "—")],
      ["Ứng dụng", (r) => USAGE_SOURCES[r.source] ?? r.source],
      ["Thời gian hoạt động", (r) => <span className="tabular-nums">{fmtDur(r.activeSec)}</span>],
      ["Số trang xem", (r) => <span className="tabular-nums">{r.pageViews}</span>],
      ["Lần cuối", (r) => <span className="tabular-nums">{fmtTime(r.lastSeenAt)}</span>],
      ["Đơn vị", (r) => r.unitName ?? "—"],
    ],
  },
];

function UsagePages({ row }) {
  const { data, isLoading, isError } = useAuditUsagePagesQuery(row.userId, row.day, row.source);
  return (
    <div className="space-y-2">
      {isLoading ? <p className="text-xs text-muted-foreground">Đang tải…</p> : null}
      {isError ? <p className="text-xs text-destructive">Không tải được dữ liệu.</p> : null}
      {data?.length ? (
        <div className="max-h-80 overflow-auto" data-local-scroll="true">
          <table className="w-full text-xs">
            <tbody>
              {data.map((e) => (
                <tr key={e.id} className="border-t border-border/60">
                  <td className="py-1 pr-3 tabular-nums text-muted-foreground">{new Date(e.occurredAt).toLocaleTimeString("vi-VN")}</td>
                  <td className="py-1 pr-3">{e.kind === "ACTION" ? (e.label ?? "Thao tác") : "Xem"}</td>
                  <td className="break-all py-1">{e.path}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !isLoading && !isError ? <p className="text-xs text-muted-foreground">Không có dữ liệu.</p> : null}
    </div>
  );
}

function ChangeDiff({ id }) {
  const { data, isLoading, isError } = useAuditChangeDetailQuery(id);
  const changes = data?.changes ?? {};
  const rows = data?.action === "UPDATE"
    ? Object.entries(changes).map(([k, v]) => [k, v?.from, v?.to])
    : Object.entries(changes).map(([k, v]) => (data?.action === "DELETE" ? [k, v, undefined] : [k, undefined, v]));
  const show = (v) => (v === undefined ? "" : v === null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
  return (
    <div className="space-y-2">
      {isLoading ? <p className="text-xs text-muted-foreground">Đang tải…</p> : null}
      {isError ? <p className="text-xs text-destructive">Không tải được dữ liệu.</p> : null}
      {!isLoading && data ? (
        <div className="overflow-x-auto overscroll-x-contain">
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

function DetailRows({ rows }) {
  return (
    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 break-words">{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

const DETAIL_TITLES = { auth: "Chi tiết đăng nhập", changes: "Chi tiết thay đổi dữ liệu", usage: "Chi tiết sử dụng" };

function LogDetailModal({ tab, row, onClose }) {
  useEffect(() => {
    if (!row) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [row, onClose]);

  if (!row) return null;

  const user = userLabel(row);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="presentation">
      <button type="button" className="absolute inset-0 bg-background/80 backdrop-blur-[1px]" aria-label="Đóng" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-log-detail-title"
        className="relative flex max-h-[min(92dvh,48rem)] w-full max-w-3xl flex-col rounded-t-xl border border-border bg-card shadow-lg sm:rounded-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 pb-3 pt-4 sm:px-5">
          <div className="min-w-0">
            <p id="audit-log-detail-title" className="text-sm font-semibold">{DETAIL_TITLES[tab.id] ?? "Chi tiết nhật ký"}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {tab.id === "changes" ? `${row.modelLabel ?? row.model ?? ""} #${row.recordId ?? "—"} · ${fmtTime(row.occurredAt)}` : `${user} · ${tab.id === "usage" ? row.day : fmtTime(row.occurredAt)}`}
            </p>
          </div>
          <Button variant="ghost" className="shrink-0 px-2 py-1 text-xs" onClick={onClose} aria-label="Đóng chi tiết">
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        <div data-local-scroll="true" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-4 py-3 sm:px-5">
          {tab.id === "auth" ? (
            <DetailRows rows={[
              ["Thời gian", fmtTime(row.occurredAt)],
              ["Người dùng", user],
              ["Tài khoản đăng nhập", row.identifier ?? row.user?.username],
              ["Sự kiện", <span key="type" className="inline-flex items-center gap-1.5"><Badge map={AUTH_TYPES} value={row.type} />{row.failReason ? <span className="text-xs text-muted-foreground">{failReasonLabel(row.failReason)}</span> : null}</span>],
              ["Đơn vị", row.unitName],
              ["IP", row.ip],
              ["Thiết bị", shortUa(row.userAgent)],
              ["User agent", <span key="ua" className="break-all text-xs">{row.userAgent ?? "—"}</span>],
            ]} />
          ) : null}

          {tab.id === "changes" ? (
            <>
              <DetailRows rows={[
                ["Thời gian", fmtTime(row.occurredAt)],
                ["Người dùng", user],
                ["Thao tác", <Badge key="action" map={CHANGE_ACTIONS} value={row.action} />],
                ["Đối tượng", row.modelLabel ?? row.model],
                ["Mã bản ghi", row.recordId],
                ["Đơn vị", row.unitName],
              ]} />
              <ChangeDiff id={row.id} />
            </>
          ) : null}

          {tab.id === "usage" ? (
            <>
              <DetailRows rows={[
                ["Ngày", row.day],
                ["Người dùng", user],
                ["Ứng dụng", USAGE_SOURCES[row.source] ?? row.source],
                ["Thời gian hoạt động", fmtDur(row.activeSec)],
                ["Số trang xem", row.pageViews],
                ["Lần cuối", fmtTime(row.lastSeenAt)],
                ["Đơn vị", row.unitName],
              ]} />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Trang / thao tác đã xem</p>
                <UsagePages row={row} />
              </div>
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end border-t border-border px-4 py-3 sm:px-5">
          <Button variant="ghost" className="px-3 py-1.5 text-sm" onClick={onClose}>Đóng</Button>
        </div>
      </div>
    </div>
  );
}

function LogTab({ tab }) {
  const canExport = useHasPermission(PERMISSIONS.AUDIT_LOGS_EXPORT);
  const users = useAuditLogUsersQuery();
  const [draft, setDraft] = useState({ userId: "", from: todayVn(7), to: todayVn(0), type: "" });
  const [filters, setFilters] = useState(draft);
  const [cursors, setCursors] = useState([undefined]);
  const [detail, setDetail] = useState(null);
  const [exporting, setExporting] = useState(false);
  const cursor = cursors[cursors.length - 1];
  const query = { userId: filters.userId, from: filters.from, to: filters.to, ...(tab.typeParam ? { [tab.typeParam]: filters.type } : {}) };
  const { data, isLoading, isError, isFetching } = useAuditLogListQuery(tab.id, query, cursor);
  const items = data?.items ?? [];

  useEffect(() => setDetail(null), [filters, cursor]);

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
            {tab.typeLabel ?? "Loại"}
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

      <div className="overflow-x-auto overscroll-x-contain rounded-lg border border-border">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              {tab.columns.map(([h]) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
              <th className="px-3 py-2 font-medium">Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr
                key={r.id}
                className={cn("border-t border-border/60", tab.rowClick && "cursor-pointer hover:bg-muted/40")}
                onClick={tab.rowClick ? () => setDetail(r) : undefined}
              >
                {tab.columns.map(([h, render]) => <td key={h} className="px-3 py-1.5 align-top">{render(r)}</td>)}
                <td className="px-3 py-1.5 align-top">
                  <Button
                    variant="ghost"
                    className="gap-1 px-2 py-1 text-xs whitespace-nowrap"
                    onClick={(e) => { e.stopPropagation(); setDetail(r); }}
                    aria-label={`Xem chi tiết dòng nhật ký ${r.id}`}
                  >
                    <Eye className="size-3.5" aria-hidden />
                    Chi tiết
                  </Button>
                </td>
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

      <LogDetailModal tab={tab} row={detail} onClose={() => setDetail(null)} />
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

