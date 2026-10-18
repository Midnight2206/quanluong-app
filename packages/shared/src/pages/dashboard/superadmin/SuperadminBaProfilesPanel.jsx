"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TabPanel } from "@/components/common/TabPanel";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import {
  useBaBaselineDocQuery,
  useBaBaselineQuery,
  useBaBaselineVersionsQuery,
  useBaComparisonQuery,
  useBaLatestProfilesQuery,
  useBaProfileQuery,
  useBaProposalsQuery,
  usePublishBaBaselineMutation,
  useReviewBaProposalMutation,
} from "@/features/ba-profiles/api/baProfilesApi";
import { BaTokenManager } from "@/features/ba-profiles/components/BaTokenManager";
import { notifyError, notifySuccess } from "@/services/notify";
import { fieldClass } from "@/utils/fieldClass";
import { cn } from "@/utils/cn";

const DOCS = [
  ["huong-dan", "Hướng dẫn"],
  ["nghiep-vu-chung", "Nghiệp vụ chung"],
  ["mau-ho-so", "Mẫu hồ sơ"],
  ["bo-cau-hoi", "Bộ câu hỏi"],
];
const CELL = {
  GIONG: ["G", "bg-success/15 text-success"],
  KHAC: ["K", "bg-warning/15 text-warning"],
  NA: ["NA", "bg-muted text-muted-foreground"],
  CHUA_RO: ["?", "bg-info/15 text-info"],
};
const PROPOSAL_STATUS = { OPEN: "Mở", ACCEPTED: "Đã nhận", REJECTED: "Từ chối" };

function fmt(iso) {
  return iso ? new Date(iso).toLocaleString("vi-VN") : "—";
}

function Status({ isLoading, isError, empty }) {
  if (isLoading) return <p className="text-xs text-muted-foreground">Đang tải…</p>;
  if (isError) return <p className="text-xs text-destructive">Không tải được dữ liệu.</p>;
  if (empty) return <p className="text-xs text-muted-foreground">Chưa có dữ liệu.</p>;
  return null;
}

function MarkdownBox({ children }) {
  return (
    <pre
      data-local-scroll="true"
      className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-3 text-xs"
    >
      {children}
    </pre>
  );
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
      {!isLoading && data ? <MarkdownBox>{data.contentMarkdown}</MarkdownBox> : null}
    </div>
  );
}

function ProfilesTab() {
  const { data, isLoading, isError } = useBaLatestProfilesQuery();
  const [openId, setOpenId] = useState(null);
  const rows = Array.isArray(data) ? data : [];
  return (
    <div className="space-y-3">
      <Status isLoading={isLoading} isError={isError} empty={!rows.length} />
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
      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-sm font-medium">Mã khóa đọc toàn bộ (GLOBAL_READ)</p>
        <BaTokenManager scope="GLOBAL_READ" />
      </div>
      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-sm font-medium">Mã khóa đăng bộ chung + duyệt đề xuất (GLOBAL_WRITE)</p>
        <BaTokenManager scope="GLOBAL_WRITE" />
      </div>
    </div>
  );
}

function ComparisonTab() {
  const { data, isLoading, isError } = useBaComparisonQuery();
  const units = data?.units ?? [];
  const rules = data?.rules ?? [];
  const riengUnits = units.filter((u) => data?.riengByUnit?.[u.unitId]?.length);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Bộ chung v{data?.baselineVersion ?? "—"} · {units.length} đơn vị
      </p>
      <Status isLoading={isLoading} isError={isError} empty={!units.length || !rules.length} />
      {units.length && rules.length ? (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-2 py-1.5 text-left font-semibold">Quy tắc</th>
                {units.map((u) => (
                  <th key={u.unitId} className="px-2 py-1.5 text-center font-semibold" title={`v${u.version}`}>
                    {u.unitName ?? `#${u.unitId}`}
                  </th>
                ))}
                <th className="px-2 py-1.5 text-center font-semibold">%G</th>
                <th className="px-2 py-1.5 text-center font-semibold">G/K/NA/?/—</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rules.map((r) => (
                <tr key={r.ruleId}>
                  <td className="px-2 py-1 font-mono">{r.ruleId}</td>
                  {units.map((u) => {
                    const c = r.cells[u.unitId];
                    const [label, tone] = c ? CELL[c.status] : ["—", "text-muted-foreground"];
                    return (
                      <td key={u.unitId} className="px-1 py-1 text-center">
                        <span
                          className={cn("inline-block min-w-8 rounded-lg px-1.5 py-0.5", tone)}
                          title={[c?.note, c?.evidence && `[${c.evidence}]`].filter(Boolean).join(" ")}
                        >
                          {label}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-center tabular-nums">{r.giongPercent ?? "—"}</td>
                  <td className="px-2 py-1 text-center tabular-nums text-muted-foreground">
                    {[r.counts.GIONG, r.counts.KHAC, r.counts.NA, r.counts.CHUA_RO, r.counts.MISSING].join("/")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {riengUnits.map((u) => (
        <div key={u.unitId} className="space-y-1">
          <p className="text-sm font-medium">RIENG · {u.unitName ?? `#${u.unitId}`}</p>
          <ul className="space-y-0.5 text-xs">
            {data.riengByUnit[u.unitId].map((r) => (
              <li key={r.ruleId}>
                <span className="font-mono">{r.ruleId}</span> · {CELL[r.status]?.[0]} {r.note ? `· ${r.note}` : ""}
                {r.evidence ? ` [${r.evidence}]` : ""}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ProposalRow({ p }) {
  const [comment, setComment] = useState(p.reviewComment ?? "");
  const [review, { isLoading }] = useReviewBaProposalMutation();
  async function setStatus(status) {
    try {
      await review({ id: p.id, status, reviewComment: comment.trim() || null });
      notifySuccess("Đã cập nhật đề xuất.");
    } catch (error) {
      notifyError(error?.data?.message || "Không cập nhật được.");
    }
  }
  return (
    <li className="space-y-2 p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span>
          <b>{p.unitName}</b> · {p.title}
        </span>
        <span className="text-xs text-muted-foreground">
          {PROPOSAL_STATUS[p.status]} · {fmt(p.createdAt)}
        </span>
      </div>
      {p.relatedRuleIds?.length ? (
        <p className="font-mono text-xs text-muted-foreground">{p.relatedRuleIds.join(", ")}</p>
      ) : null}
      {p.description ? <p className="whitespace-pre-wrap text-xs">{p.description}</p> : null}
      <MarkdownBox>{p.proposedText}</MarkdownBox>
      <div className="flex flex-wrap items-center gap-2" data-no-unsaved-mark="true">
        <input
          className={cn(fieldClass, "min-w-0 flex-1 py-2")}
          placeholder="Nhận xét"
          value={comment}
          maxLength={10000}
          onChange={(e) => setComment(e.target.value)}
        />
        <Button type="button" className="px-3 py-2 text-xs" disabled={isLoading} onClick={() => setStatus("ACCEPTED")}>
          Nhận
        </Button>
        <Button
          type="button"
          variant="dangerGhost"
          className="px-3 py-2 text-xs"
          disabled={isLoading}
          onClick={() => setStatus("REJECTED")}
        >
          Từ chối
        </Button>
        {p.status !== "OPEN" ? (
          <Button type="button" variant="ghost" className="px-3 py-2 text-xs" disabled={isLoading} onClick={() => setStatus("OPEN")}>
            Mở lại
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function ProposalsTab() {
  const [status, setStatus] = useState("OPEN");
  const { data, isLoading, isError } = useBaProposalsQuery(status || undefined);
  const rows = Array.isArray(data) ? data : [];
  return (
    <div className="space-y-3">
      <select className={cn(fieldClass, "w-auto py-2")} value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="OPEN">Mở</option>
        <option value="ACCEPTED">Đã nhận</option>
        <option value="REJECTED">Từ chối</option>
        <option value="">Tất cả</option>
      </select>
      <Status isLoading={isLoading} isError={isError} empty={!rows.length} />
      {rows.length ? (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {rows.map((p) => (
            <ProposalRow key={p.id} p={p} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function BaselineDoc({ docKey, latest }) {
  const [version, setVersion] = useState(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const versions = useBaBaselineVersionsQuery(docKey);
  const doc = useBaBaselineDocQuery(docKey, version);
  const [publish, { isLoading: publishing }] = usePublishBaBaselineMutation();

  function startEdit() {
    setTitle(doc.data?.title ?? "");
    setContent(doc.data?.contentMarkdown ?? "");
    setEditing(true);
  }

  async function onPublish() {
    try {
      const res = await publish({ docKey, title: title.trim(), contentMarkdown: content });
      notifySuccess(`Đã đăng v${res?.version ?? ""}.`);
      setEditing(false);
      setVersion(null);
    } catch (error) {
      notifyError(error?.data?.message || "Không đăng được.");
    }
  }

  const list = Array.isArray(versions.data) ? versions.data : [];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={cn(fieldClass, "w-auto py-2")}
          value={version ?? ""}
          onChange={(e) => setVersion(e.target.value ? Number(e.target.value) : null)}
          disabled={!list.length}
        >
          <option value="">Mới nhất{latest ? ` (v${latest.version})` : ""}</option>
          {list.map((v) => (
            <option key={v.id} value={v.version}>
              v{v.version} · {fmt(v.createdAt)} · {v.publishedBy ?? "—"}
            </option>
          ))}
        </select>
        {!editing ? (
          <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={startEdit}>
            Đăng phiên bản mới
          </Button>
        ) : null}
      </div>
      {editing ? (
        <div className="space-y-2" data-no-unsaved-mark="true">
          <input
            className={fieldClass}
            placeholder="Tiêu đề"
            value={title}
            maxLength={255}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className={cn(fieldClass, "min-h-[50vh] font-mono text-xs")}
            placeholder="Nội dung Markdown"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              className="px-3 py-2 text-xs"
              disabled={publishing || !title.trim() || !content.trim()}
              onClick={onPublish}
            >
              {publishing ? <Loader2 className="size-4 animate-spin" /> : null}
              <span>Đăng</span>
            </Button>
            <Button type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={() => setEditing(false)}>
              Huỷ
            </Button>
          </div>
        </div>
      ) : doc.isError ? (
        <p className="text-xs text-muted-foreground">Chưa có phiên bản nào.</p>
      ) : doc.data ? (
        <MarkdownBox>{doc.data.contentMarkdown}</MarkdownBox>
      ) : (
        <Status isLoading={doc.isLoading} />
      )}
    </div>
  );
}

function BaselineTab() {
  const { data } = useBaBaselineQuery();
  const latestByKey = Object.fromEntries((Array.isArray(data) ? data : []).map((d) => [d.docKey, d]));
  const [docKey, setDocKey] = useState(DOCS[0][0]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {DOCS.map(([key, label]) => (
          <Button
            key={key}
            type="button"
            variant={key === docKey ? "primary" : "ghost"}
            className="px-3 py-1.5 text-xs"
            onClick={() => setDocKey(key)}
          >
            {label}
            {latestByKey[key] ? ` · v${latestByKey[key].version}` : ""}
          </Button>
        ))}
      </div>
      <BaselineDoc key={docKey} docKey={docKey} latest={latestByKey[docKey]} />
    </div>
  );
}

export function SuperadminBaProfilesPanel() {
  const user = useCurrentUser();
  if (user?.type?.name !== "superadmin") {
    return <p className="text-sm text-muted-foreground">Chỉ superadmin xem trang này.</p>;
  }
  return (
    <Card className="shadow-soft">
      <CardContent className="space-y-3">
        <p className="text-sm font-semibold">Hồ sơ nghiệp vụ đơn vị</p>
        <TabPanel
          persistId="superadmin-ba-profiles"
          tabs={[
            { id: "profiles", label: "Hồ sơ", panel: <ProfilesTab /> },
            { id: "comparison", label: "Bảng so sánh", panel: <ComparisonTab /> },
            { id: "proposals", label: "Đề xuất", panel: <ProposalsTab /> },
            { id: "baseline", label: "Bộ chung", panel: <BaselineTab /> },
          ]}
        />
      </CardContent>
    </Card>
  );
}
