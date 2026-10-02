"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  useApplyLttpIssueSlipAiDraftChatMutation,
  useChatLttpIssueSlipAiMutation,
  useCommitLttpIssueSlipAiMemoryMutation,
  usePatchLttpIssueSlipAiDraftLineMutation,
  useProposeLttpIssueSlipAiDraftChatMutation,
  useSuggestLttpIssueSlipAiMutation,
  useUndoLttpIssueSlipAiDraftChatMutation,
} from "@/features/lttp/api/lttpApi";
import { notifyError } from "@/services/notify";
import { formatVnd } from "@/utils/formatVnd";
import { issueSlipPriceKindLabel } from "./lttpIssueSlipPriceKind.js";

const inputClass =
  "w-full min-w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

function headerField(label, value) {
  if (value == null || value === "") {
    return null;
  }
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <span>{value}</span>
    </p>
  );
}

function normalizePreview(data) {
  if (!data) {
    return null;
  }
  return {
    headerDraft: data.headerDraft ?? null,
    lines: Array.isArray(data.lines) ? data.lines : [],
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    meta: data.meta ?? null,
  };
}

function lineStatusLabel(line) {
  if (line?.status === "edited" || line?.lineStatus === "edited") return "đã sửa";
  if (line?.needsConfirm || line?.status === "needs_confirm" || line?.lineStatus === "needs_confirm") {
    return "cần xác nhận";
  }
  return "chắc";
}

function catalogMatches(catalog, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (needle.length < 1) return [];
  return (catalog || [])
    .filter((item) => {
      const name = String(item.name || "").toLowerCase();
      const code = String(item.code || "").toLowerCase();
      return name.includes(needle) || code.includes(needle);
    })
    .slice(0, 6);
}

function mergeDraftLines(preview, draft) {
  const byId = new Map((draft?.lines || []).map((line) => [line.id, line]));
  return {
    ...preview,
    lines: (preview?.lines || []).map((line) => {
      const stored = byId.get(line.draftLineId);
      if (!stored) return line;
      return {
        ...line,
        commodityId: stored.commodityId == null ? null : Number(stored.commodityId),
        commodityName: stored.commodityName,
        code: stored.code,
        quantity: stored.quantity == null ? null : Number(stored.quantity),
        measureUnit: stored.measureUnit,
        lttpSupplierId: stored.lttpSupplierId ?? null,
        unitPrice: stored.unitPrice == null ? null : Number(stored.unitPrice),
        status: stored.status,
        lineStatus: stored.status,
        needsConfirm: stored.status === "needs_confirm",
        mapped: Number(stored.lttpSupplierId) > 0,
      };
    }),
    meta: {
      ...(preview?.meta ?? {}),
      draftId: draft.id,
      draftVersion: draft.version,
    },
  };
}

function mergePreviewMeta(baseMeta, nextMeta) {
  if (!baseMeta && !nextMeta) {
    return null;
  }
  return {
    ...(baseMeta ?? {}),
    ...(nextMeta ?? {}),
    historySampleCount:
      baseMeta?.historySampleCount ?? nextMeta?.historySampleCount ?? 0,
    memorySampleCount:
      baseMeta?.memorySampleCount ?? nextMeta?.memorySampleCount ?? 0,
  };
}

export function LttpIssueSlipAiSuggestDialog({
  open,
  onClose,
  unitId,
  issueDate,
  receivedDate,
  recipientUnitId,
  recipientUserId,
  catalog = [],
  onApply,
  onCommit,
}) {
  const [prompt, setPrompt] = useState("");
  const [preview, setPreview] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [chatMessage, setChatMessage] = useState("");
  const [turns, setTurns] = useState([]);
  const [draftVersion, setDraftVersion] = useState(null);
  const [skuQuery, setSkuQuery] = useState({});
  const [ticked, setTicked] = useState([]);
  const [pending, setPending] = useState(null);
  const [acceptRule, setAcceptRule] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [suggestAi, { isLoading: suggesting }] = useSuggestLttpIssueSlipAiMutation();
  const [chatAi, { isLoading: chatting }] = useChatLttpIssueSlipAiMutation();
  const [proposeChat, { isLoading: proposing }] = useProposeLttpIssueSlipAiDraftChatMutation();
  const [applyChat, { isLoading: applyingChat }] = useApplyLttpIssueSlipAiDraftChatMutation();
  const [undoChat, { isLoading: undoing }] = useUndoLttpIssueSlipAiDraftChatMutation();
  const [commitAi, { isLoading: committing }] = useCommitLttpIssueSlipAiMemoryMutation();
  const [patchDraftLine, { isLoading: patching }] = usePatchLttpIssueSlipAiDraftLineMutation();

  function resetDialog() {
    setPrompt("");
    setPreview(null);
    setSessionId(null);
    setChatMessage("");
    setTurns([]);
    setDraftVersion(null);
    setSkuQuery({});
    setTicked([]);
    setPending(null);
    setAcceptRule(false);
    setConfirmAll(false);
    setCanUndo(false);
  }

  useEffect(() => {
    if (!open) {
      resetDialog();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const busy = suggesting || chatting || proposing || applyingChat || undoing || committing || patching;
  const draftId = preview?.meta?.draftId ?? null;
  const eligibleIds = (preview?.lines || [])
    .filter((line) => draftId && line.draftLineId && lineStatusLabel(line) !== "cần xác nhận")
    .map((line) => line.draftLineId);
  const allTicked = eligibleIds.length > 0 && eligibleIds.every((id) => ticked.includes(id));
  const historyCount = preview?.meta?.historySampleCount ?? 0;
  const memoryCount = preview?.meta?.memorySampleCount ?? 0;
  const unmapped =
    preview?.lines?.filter((l) => !l?.mapped).length ?? 0;
  const pendingConfirm =
    preview?.lines?.some(
      (l) => l?.needsConfirm || l?.status === "needs_confirm" || l?.lineStatus === "needs_confirm",
    ) ?? false;

  function applyLocalChoice(index, choice) {
    setPreview((prev) => {
      if (!prev) return prev;
      const lines = prev.lines.map((line, i) =>
        i === index
          ? {
              ...line,
              commodityId: Number(choice.commodityId),
              commodityName: choice.name || choice.commodityName,
              code: choice.code,
              mapped: Boolean(choice.lttpSupplierId),
              needsConfirm: false,
              status: "edited",
              lineStatus: "edited",
              source: "confirm",
              lttpSupplierId: choice.lttpSupplierId ?? null,
              unitPrice: choice.unitPrice ?? line.unitPrice,
              tgsxPrice: choice.tgsxPrice ?? line.tgsxPrice ?? null,
              measureUnit: choice.measureUnit || line.measureUnit,
            }
          : line,
      );
      return { ...prev, lines };
    });
  }

  async function pickChoice(index, choice, source) {
    const line = preview?.lines?.[index];
    if (!line) return;
    const draftId = preview?.meta?.draftId;
    if (!draftId || !line.draftLineId) {
      applyLocalChoice(index, choice);
      return;
    }
    try {
      const data = await patchDraftLine({
        id: draftId,
        lineId: line.draftLineId,
        unitId,
        version: draftVersion,
        source,
        commodityId: Number(choice.commodityId),
        commodityName: choice.name || choice.commodityName || null,
        code: choice.code || null,
        ...(line.quantity != null && Number(line.quantity) > 0
          ? { quantity: Number(line.quantity) }
          : {}),
        measureUnit: choice.measureUnit || line.measureUnit || null,
        ...(choice.lttpSupplierId ? { lttpSupplierId: Number(choice.lttpSupplierId) } : {}),
        ...(choice.unitPrice != null || line.unitPrice != null
          ? { unitPrice: Number(choice.unitPrice ?? line.unitPrice) }
          : {}),
      }).unwrap();
      setDraftVersion(data?.version ?? draftVersion);
      setCanUndo(false);
      applyLocalChoice(index, choice);
      setSkuQuery((prev) => ({ ...prev, [index]: "" }));
    } catch (e) {
      notifyError(e?.data?.message ?? "Không lưu được lựa chọn");
    }
  }

  async function handleSuggest() {
    const trimmed = prompt.trim();
    if (trimmed.length < 3) {
      notifyError("Mô tả cần ít nhất 3 ký tự");
      return;
    }
    try {
      const data = await suggestAi({
        unitId,
        prompt: trimmed,
        ...(issueDate ? { issueDate } : {}),
        ...(receivedDate ? { receivedDate } : {}),
        ...(recipientUnitId != null && recipientUnitId !== ""
          ? { recipientUnitId: Number(recipientUnitId) }
          : {}),
        ...(recipientUserId != null && recipientUserId !== ""
          ? { recipientUserId: Number(recipientUserId) }
          : {}),
      }).unwrap();
      setSessionId(data?.sessionId ?? null);
      setDraftVersion(data?.meta?.draftVersion ?? null);
      setSkuQuery({});
      setPreview(normalizePreview(data));
      setChatMessage("");
      setTurns([]);
      setTicked([]);
      setPending(null);
      setAcceptRule(false);
      setConfirmAll(false);
      setCanUndo(false);
    } catch (e) {
      notifyError(e?.data?.message ?? "Gợi ý AI thất bại");
    }
  }

  async function handleChat() {
    const trimmed = chatMessage.trim();
    if (!preview || !sessionId) {
      notifyError("Chưa có phiên AI để tiếp tục chat");
      return;
    }
    if (!trimmed) {
      notifyError("Nhập nội dung cần chỉnh");
      return;
    }
    if (preview?.meta?.draftId) {
      if (!ticked.length) {
        notifyError("Chọn ít nhất một dòng để chat sửa");
        return;
      }
      try {
        const data = await proposeChat({
          id: preview.meta.draftId,
          unitId,
          message: trimmed,
          lineIds: ticked,
        }).unwrap();
        setPending(data);
        setAcceptRule(false);
        setChatMessage("");
        setTurns((prev) => [
          ...prev,
          { role: "user", text: trimmed },
          { role: "assistant", text: data?.explanation || "Đã có bản sửa. Xem diff rồi bấm Áp dụng hoặc Bỏ." },
        ]);
      } catch (e) {
        notifyError(e?.data?.message ?? "Giữ nguyên bản nháp. Hãy thử lại hoặc dùng nút chọn.");
      }
      return;
    }
    try {
      const data = await chatAi({
        sessionId,
        unitId,
        message: trimmed,
        currentPreview: preview,
        ...(recipientUnitId != null && recipientUnitId !== ""
          ? { recipientUnitId: Number(recipientUnitId) }
          : {}),
        ...(recipientUserId != null && recipientUserId !== ""
          ? { recipientUserId: Number(recipientUserId) }
          : {}),
      }).unwrap();
      setPreview((prev) => {
        const next = normalizePreview(data);
        if (!next) {
          return next;
        }
        return {
          ...next,
          meta: mergePreviewMeta(prev?.meta, next.meta),
        };
      });
      setChatMessage("");
      setTurns((prev) => [
        ...prev,
        { role: "user", text: trimmed },
        { role: "assistant", text: "Đã cập nhật bản xem trước." },
      ]);
    } catch (e) {
      notifyError(e?.data?.message ?? "Chat AI thất bại");
    }
  }

  async function handleApplyPending() {
    if (!pending?.turnId || !draftId) return;
    try {
      const data = await applyChat({
        id: draftId,
        unitId,
        version: draftVersion,
        turnId: pending.turnId,
        acceptRule,
      }).unwrap();
      setPreview((prev) => mergeDraftLines(prev, data));
      setDraftVersion(data?.version ?? draftVersion);
      setPending(null);
      setAcceptRule(false);
      setCanUndo(true);
    } catch (e) {
      notifyError(e?.data?.message ?? "Không áp dụng được bản sửa");
    }
  }

  async function handleUndoChat() {
    if (!draftId) return;
    try {
      const data = await undoChat({
        id: draftId,
        unitId,
        version: draftVersion,
      }).unwrap();
      setPreview((prev) => mergeDraftLines(prev, data));
      setDraftVersion(data?.version ?? draftVersion);
      setCanUndo(false);
    } catch (e) {
      notifyError(e?.data?.message ?? "Không hoàn tác được");
    }
  }

  async function handleCommitDraft() {
    if (!preview?.meta?.draftId || !onCommit) return;
    if (pendingConfirm) {
      notifyError("Còn dòng cần xác nhận trước khi chốt");
      return;
    }
    try {
      if (sessionId) {
        await commitAi({
          sessionId,
          unitId,
          finalPreview: preview,
        }).unwrap();
      }
      await onCommit(preview, {
        sessionId,
        orderMessageId: preview.meta?.orderMessageId ?? null,
        draftId: preview.meta.draftId,
        draftVersion,
        confirmAll,
      });
      resetDialog();
      onClose?.();
    } catch (e) {
      if (!e?.notified) {
        notifyError(e?.data?.message ?? "Không chốt được phiếu");
      }
    }
  }

  async function handleApply() {
    if (!preview) {
      return;
    }
    if (!sessionId) {
      notifyError("Chưa có sessionId AI để áp dụng");
      return;
    }
    try {
      await commitAi({
        sessionId,
        unitId,
        finalPreview: preview,
      }).unwrap();
      onApply?.(preview, {
        sessionId,
        orderMessageId: preview.meta?.orderMessageId ?? null,
        draftId: preview.meta?.draftId ?? null,
        draftVersion,
        confirmAll,
      });
      resetDialog();
      onClose?.();
    } catch (e) {
      notifyError(e?.data?.message ?? "Không lưu được ghi nhớ AI");
    }
  }

  function handleClose() {
    resetDialog();
    onClose?.();
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-border bg-card shadow-xl">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-semibold">AI gợi ý phiếu</h3>
          <p className="text-xs text-muted-foreground">
            {issueDate ? `Ngày phiếu: ${issueDate}` : "Tạo phiếu xuất mới"}
            {preview ? ` · thói quen: ${historyCount}` : ""}
            {preview ? ` · mẫu tin: ${memoryCount}` : ""}
            {unmapped > 0 ? ` · chưa map: ${unmapped} dòng` : ""}
          </p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-4" data-local-scroll="true">
          <label className="block space-y-1 text-xs">
            Mô tả phiếu xuất
            <textarea
              className={`${inputClass} min-h-[5rem] resize-y`}
              rows={4}
              maxLength={2000}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ví dụ: Xuất 10 kg gạo tẻ và 5 kg thịt heo cho bếp trưa ngày mai, giá mua TT…"
              disabled={busy}
            />
          </label>
          {(preview?.warnings || []).length > 0 ? (
            <ul className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
              {preview.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : null}
          {preview ? (
            <>
              <section className="space-y-2 rounded-md border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <header className="text-sm font-semibold">Trao đổi với AI</header>
                  <span className="text-[11px] text-muted-foreground">Phiên: {sessionId}</span>
                </div>
                {turns.length > 0 ? (
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-md bg-muted/30 p-2 text-xs">
                    {turns.map((turn, i) => (
                      <div key={`${turn.role}-${i}`} className="rounded-md bg-background px-2 py-1">
                        <span className="font-medium">
                          {turn.role === "user" ? "Bạn" : "AI"}:
                        </span>{" "}
                        <span>{turn.text}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {draftId
                      ? "Tick dòng chắc hoặc đã sửa, rồi chat để sửa những dòng đó."
                      : "Có thể chat để chỉnh lại preview sau khi đã gợi ý."}
                  </p>
                )}
                {pending ? (
                  <div className="space-y-2 rounded-md border border-border bg-muted/20 p-2 text-xs">
                    <p>{pending.explanation || "Bản sửa từ chat"}</p>
                    {(pending.diff || []).map((op) => (
                      <p key={op.lineId}>
                        {op.before?.commodityName || "—"} {op.before?.quantity ?? "—"}{" "}
                        {op.before?.measureUnit || ""} → {op.after?.commodityName || "—"}{" "}
                        {op.after?.quantity ?? "—"} {op.after?.measureUnit || ""}
                      </p>
                    ))}
                    {(pending.dropped || []).map((item, i) => (
                      <p key={`${item.lineId}-${i}`} className="text-amber-800 dark:text-amber-200">
                        Bỏ qua dòng {item.lineId}: {item.reason}
                      </p>
                    ))}
                    {pending.ruleSuggestion ? (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={acceptRule}
                          onChange={(e) => setAcceptRule(e.target.checked)}
                        />
                        Lưu cho lần sau?
                      </label>
                    ) : null}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => void handleApplyPending()}
                        disabled={busy || (!(pending.diff || []).length && !pending.ruleSuggestion)}
                      >
                        Áp dụng
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setPending(null);
                          setAcceptRule(false);
                        }}
                        disabled={busy}
                      >
                        Bỏ
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className={inputClass}
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder={
                      draftId
                        ? "Ví dụ: dòng đã chọn đổi thành 2 lô"
                        : "Ví dụ: đổi 5 kg gạo tẻ thành 7 kg gạo nếp"
                    }
                    disabled={busy}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleChat();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleChat()}
                    disabled={busy || !chatMessage.trim()}
                  >
                    {chatting || proposing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    Gửi
                  </Button>
                  {draftId && canUndo ? (
                    <Button type="button" variant="outline" onClick={() => void handleUndoChat()} disabled={busy}>
                      Hoàn tác
                    </Button>
                  ) : null}
                </div>
              </section>
              <section className="rounded-md border border-border px-3 py-2">
                <header className="mb-2 text-sm font-semibold">Header</header>
                <div className="space-y-0.5">
                  {headerField("Ngày xuất", preview.headerDraft?.issueDate)}
                  {headerField("Ngày nhận", preview.headerDraft?.receivedDate)}
                  {headerField(
                    "Đơn vị nhận",
                    preview.headerDraft?.recipientDisplayName ??
                      preview.headerDraft?.recipientUnitId,
                  )}
                  {headerField(
                    "Người mua",
                    preview.headerDraft?.buyerDisplayName ?? preview.headerDraft?.buyerUserId,
                  )}
                  {headerField("Chú thích", preview.headerDraft?.slipNote)}
                  {!preview.headerDraft ||
                  !Object.values(preview.headerDraft).some((v) => v != null && v !== "") ? (
                    <p className="text-xs text-muted-foreground">— Không gợi ý header —</p>
                  ) : null}
                </div>
              </section>
              <section className="rounded-md border border-border">
                <header className="border-b border-border bg-muted/30 px-3 py-1.5 text-sm font-semibold">
                  Dòng hàng
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground">
                        {draftId ? (
                          <th className="px-3 py-1.5 font-medium">
                            <input
                              type="checkbox"
                              aria-label="Chọn tất cả dòng chat được"
                              checked={allTicked}
                              onChange={() =>
                                setTicked(allTicked ? [] : eligibleIds)
                              }
                            />
                          </th>
                        ) : null}
                        <th className="px-3 py-1.5 font-medium">LTTP</th>
                        <th className="px-3 py-1.5 font-medium">Mã</th>
                        <th className="px-3 py-1.5 font-medium">SL</th>
                        <th className="px-3 py-1.5 font-medium">Loại giá</th>
                        <th className="px-3 py-1.5 font-medium">Đơn giá</th>
                        <th className="px-3 py-1.5 font-medium">Map</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(preview.lines || []).length === 0 ? (
                        <tr>
                          <td colSpan={draftId ? 7 : 6} className="px-3 py-2 text-xs text-muted-foreground">
                            Không có dòng gợi ý
                          </td>
                        </tr>
                      ) : (
                        preview.lines.map((line, i) => {
                          const needs = lineStatusLabel(line) === "cần xác nhận";
                          const matches = needs ? catalogMatches(catalog, skuQuery[i]) : [];
                          return (
                          <tr
                            key={line.draftLineId ?? i}
                            className={
                              needs
                                ? "border-t border-amber-500/40 bg-amber-500/10"
                                : "border-t border-border/50"
                            }
                          >
                            {draftId ? (
                              <td className="px-3 py-1 align-top">
                                <input
                                  type="checkbox"
                                  aria-label="Chọn dòng để chat sửa"
                                  checked={Boolean(line.draftLineId) && ticked.includes(line.draftLineId)}
                                  disabled={needs || !line.draftLineId}
                                  onChange={() =>
                                    setTicked((prev) =>
                                      prev.includes(line.draftLineId)
                                        ? prev.filter((id) => id !== line.draftLineId)
                                        : [...prev, line.draftLineId],
                                    )
                                  }
                                />
                              </td>
                            ) : null}
                            <td className="px-3 py-1 align-top">
                              <div>{line.commodityName || line.rawName || "—"}</div>
                              <div className="text-[11px] text-muted-foreground">
                                <span className={needs ? "font-medium text-amber-800 dark:text-amber-200" : ""}>
                                  {lineStatusLabel(line)}
                                </span>
                                {line.confidence ? ` · ${Math.round(Number(line.confidence) * 100)}%` : ""}
                              </div>
                              {needs ? (
                                <div className="mt-1 space-y-1">
                                  <div className="flex flex-col items-start gap-1">
                                    {(line.choices || []).slice(0, 3).map((choice) => (
                                      <button
                                        key={choice.commodityId}
                                        type="button"
                                        className="text-left text-xs text-primary underline"
                                        disabled={busy}
                                        onClick={() => void pickChoice(i, choice, "choice")}
                                      >
                                        {choice.name}
                                        {choice.stat ? ` (${choice.stat})` : ""}
                                      </button>
                                    ))}
                                  </div>
                                  <input
                                    className={inputClass}
                                    value={skuQuery[i] || ""}
                                    onChange={(e) =>
                                      setSkuQuery((prev) => ({ ...prev, [i]: e.target.value }))
                                    }
                                    placeholder="Tìm SKU khác"
                                    disabled={busy}
                                  />
                                  {matches.length > 0 ? (
                                    <div className="flex flex-col items-start gap-1">
                                      {matches.map((item) => (
                                        <button
                                          key={item.id}
                                          type="button"
                                          className="text-left text-xs underline"
                                          disabled={busy}
                                          onClick={() =>
                                            void pickChoice(
                                              i,
                                              {
                                                commodityId: item.id,
                                                name: item.name,
                                                code: item.code,
                                                measureUnit: item.measureUnit,
                                                lttpSupplierId: item.lttpSupplierId,
                                                unitPrice: item.unitPrice,
                                                tgsxPrice: item.tgsxPrice,
                                              },
                                              "manual",
                                            )
                                          }
                                        >
                                          {item.code ? `${item.code} · ` : ""}
                                          {item.name}
                                        </button>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-3 py-1 align-top font-mono text-xs">{line.code || "—"}</td>
                            <td className="px-3 py-1 align-top tabular-nums">{line.quantity ?? "—"}</td>
                            <td className="px-3 py-1 align-top text-xs">
                              {line.priceKind ? issueSlipPriceKindLabel(line.priceKind) : "—"}
                            </td>
                            <td className="px-3 py-1 align-top tabular-nums text-muted-foreground">
                              {line.unitPrice != null ? formatVnd(line.unitPrice) : "—"}
                            </td>
                            <td className="px-3 py-1 align-top">
                              {line.mapped ? (
                                <span className="text-xs text-emerald-700 dark:text-emerald-300">OK</span>
                              ) : (
                                <span className="text-xs text-amber-700 dark:text-amber-300">Chưa</span>
                              )}
                            </td>
                          </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
          {draftId ? (
            <label className="mr-auto flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={confirmAll}
                onChange={(e) => setConfirmAll(e.target.checked)}
                disabled={busy}
              />
              Xác nhận cả phiếu
            </label>
          ) : null}
          <Button type="button" variant="outline" onClick={handleClose} disabled={busy}>
            Hủy
          </Button>
          <Button type="button" variant="secondary" onClick={() => void handleSuggest()} disabled={busy}>
            {suggesting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Gợi ý
          </Button>
          {draftId ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleCommitDraft()}
              disabled={busy || !preview || pendingConfirm}
            >
              Chốt phiếu
            </Button>
          ) : null}
          <Button type="button" onClick={() => void handleApply()} disabled={busy || !preview || pendingConfirm}>
            {committing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Áp dụng
          </Button>
        </div>
      </div>
    </div>
  );
}
