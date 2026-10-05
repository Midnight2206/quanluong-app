"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Send } from "lucide-react";
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
import { userAskQuestions, withUserAsk } from "./lttpIssueSlipAskQueue.js";

const inputClass =
  "w-full min-w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

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

function confidenceClass(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "text-muted-foreground";
  if (n >= 0.9) return "text-emerald-700 dark:text-emerald-300";
  if (n >= 0.75) return "text-lime-700 dark:text-lime-300";
  if (n >= 0.55) return "text-amber-700 dark:text-amber-300";
  if (n >= 0.35) return "text-orange-700 dark:text-orange-300";
  return "text-red-700 dark:text-red-300";
}

function qtyRuleLabel(rule) {
  if (!rule) return "";
  if (rule.type === "line_note") {
    return rule.enabled
      ? "Đã lưu cho mọi kho cấp 1: khi đổi đơn vị, ghi số lượng gốc vào ghi chú."
      : "Đã tắt ghi số lượng gốc vào ghi chú.";
  }
  if (rule.type !== "qty") return "";
  const from = !rule.fromUom || rule.fromUom === "*" ? "không ghi đơn vị" : rule.fromUom;
  const scope = rule.commodityNameNorm ? "mặt hàng này" : "mọi mặt hàng";
  return `Quy ước lần sau, mọi đơn vị cấp 1, ${scope}: ${from} × ${rule.factor} ra đơn vị bảng giá.`;
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
        writtenUom: stored.writtenUom ?? line.writtenUom,
        stockUom: stored.stockUom ?? line.stockUom ?? null,
        qtySource: stored.qtySource ?? line.qtySource ?? null,
        qtyFactor: stored.qtyFactor ?? line.qtyFactor ?? null,
        qtyFromUom: stored.qtyFromUom ?? line.qtyFromUom ?? null,
        lineNote: stored.lineNote ?? line.lineNote ?? "",
        askRule:
          typeof stored.askRule === "boolean"
            ? stored.askRule
            : stored.status === "needs_confirm" &&
              Boolean(stored.writtenUom ?? line.writtenUom) &&
              Boolean(stored.stockUom ?? line.stockUom) &&
              !sameUnit(stored.writtenUom ?? line.writtenUom, stored.stockUom ?? line.stockUom),
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

const SUGGEST_PLAN = ["Đang đọc tin nhắn.", "Đang chấm điểm mặt hàng.", "Đang xử lý số lượng."];
const CHAT_PLAN = ["Đang đọc yêu cầu.", "Đang xử lý quy tắc.", "Đang cập nhật dòng hàng."];
const CLOSING_QUESTION = "Bạn có yêu cầu gì khác?";

function sameUnit(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function conversionQuestions(lines) {
  return (lines || []).flatMap((line, index) => {
    const written = String(line.writtenUom || "").trim();
    const stock = String(line.stockUom || "").trim();
    if (!written || !stock || sameUnit(written, stock) || !line.askRule) return [];
    const name = line.commodityName || line.rawName || "Mặt hàng";
    return [
      {
        key: `rule:${line.draftLineId ?? index}:${written.toLowerCase()}`,
        lineIndex: index,
        draftLineId: line.draftLineId ?? null,
        text: `${name} đang ghi «${written}». Quy đổi sang ${stock} thế nào?`,
      },
    ];
  });
}

function formatFactor(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.round(n * 10000) / 10000);
}

function appliedQuestions(lines) {
  return (lines || []).flatMap((line, index) => {
    if (!line.commodityId) return [];
    const stock = String(line.stockUom || line.measureUnit || "").trim();
    const factor = formatFactor(line.qtyFactor);
    const name = line.commodityName || line.rawName || "Mặt hàng";
    if (!stock || !factor) return [];
    if (line.qtySource === "rule") {
      const from = String(line.qtyFromUom || line.writtenUom || "").trim();
      if (!from || sameUnit(from, stock)) return [];
      return [
        {
          kind: "applied",
          key: `applied:rule:${line.draftLineId ?? index}:${from.toLowerCase()}`,
          lineIndex: index,
          draftLineId: line.draftLineId ?? null,
          text: `${name}: tôi đã tách được đơn vị tính ${from}. Áp dụng quy tắc 1 ${from} = ${factor} ${stock}. Bạn có muốn thay đổi gì không?`,
        },
      ];
    }
    if (line.qtySource === "habit-uom") {
      const from = String(line.qtyFromUom || "").trim();
      if (!from) return [];
      return [
        {
          kind: "applied",
          key: `applied:habit:${line.draftLineId ?? index}:${from.toLowerCase()}`,
          lineIndex: index,
          draftLineId: line.draftLineId ?? null,
          text: `${name} thường được đặt theo ${from}, nên tôi đã áp dụng đơn vị này và quy đổi ra ${stock}: 1 ${from} = ${factor} ${stock}. Bạn có muốn thay đổi gì không?`,
        },
      ];
    }
    return [];
  });
}

function ruleQuestions(lines) {
  return conversionQuestions(lines).filter((item) => lines[item.lineIndex]?.commodityId);
}

function displayYmd(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
}

function summaryText(lines) {
  const count = (lines || []).length;
  const open = (lines || []).filter((line) => !line.commodityId).length;
  if (!count) return "Chưa tách được dòng hàng nào.";
  if (open) {
    return `Đã tách ${count} dòng. Còn ${open} dòng chưa chốt mặt hàng — chọn ở khung bên phải.`;
  }
  return `Đã tách ${count} dòng và chốt mặt hàng.`;
}

function isCanceled(error) {
  return error?.canceled === true || error?.data === "canceled";
}

function isDecline(text) {
  return /^(không|khong|không có|khong co|không đổi|khong doi|giữ nguyên|giu nguyen|hết|het|không cần|khong can|thôi|thoi)\.?$/i.test(
    String(text || "").trim(),
  );
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
  recipientLabel = "",
  recipientOptions = [],
  canPickRecipient = false,
  slipNote = "",
  onHeaderChange,
  catalog = [],
  onApply,
}) {
  const [prompt, setPrompt] = useState("");
  const [preview, setPreview] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [chatMessage, setChatMessage] = useState("");
  const [turns, setTurns] = useState([]);
  const [draftVersion, setDraftVersion] = useState(null);
  const [skuQuery, setSkuQuery] = useState({});
  const [canUndo, setCanUndo] = useState(false);
  const [plan, setPlan] = useState(null);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [activeLine, setActiveLine] = useState(null);
  const askedRef = useRef([]);
  const activeRef = useRef(null);
  const planRef = useRef(null);
  const planTimer = useRef([]);
  const workRef = useRef(null);
  const chatEndRef = useRef(null);
  const abortRef = useRef(null);
  const runRef = useRef(null);
  const [suggestAi, { isLoading: suggesting }] = useSuggestLttpIssueSlipAiMutation();
  const [chatAi, { isLoading: chatting }] = useChatLttpIssueSlipAiMutation();
  const [proposeChat, { isLoading: proposing }] = useProposeLttpIssueSlipAiDraftChatMutation();
  const [applyChat, { isLoading: applyingChat }] = useApplyLttpIssueSlipAiDraftChatMutation();
  const [undoChat, { isLoading: undoing }] = useUndoLttpIssueSlipAiDraftChatMutation();
  const [commitAi, { isLoading: committing }] = useCommitLttpIssueSlipAiMemoryMutation();
  const [patchDraftLine, { isLoading: patching }] = usePatchLttpIssueSlipAiDraftLineMutation();

  function beginRun(kind, text) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const id = {};
    runRef.current = { id, kind, text, controller };
    return { signal: controller.signal, id };
  }

  function stillRunning(id) {
    return runRef.current?.id === id;
  }

  function stopSend() {
    const run = runRef.current;
    if (!run) return;
    runRef.current = null;
    run.controller.abort();
    endPlan();
    if (run.kind === "suggest") {
      setTurns((prev) => prev.filter((turn) => !(turn.role === "user" && turn.text === run.text)));
      return;
    }
    setChatMessage(run.text);
    setTurns((prev) => {
      const next = prev.slice();
      const last = next[next.length - 1];
      if (last?.role === "user" && last.text === run.text) next.pop();
      return next;
    });
  }

  function clearPlanTimer() {
    planTimer.current.forEach(clearTimeout);
    planTimer.current = [];
  }

  function resetDialog() {
    abortRef.current?.abort();
    abortRef.current = null;
    runRef.current = null;
    clearPlanTimer();
    askedRef.current = [];
    activeRef.current = null;
    planRef.current = null;
    setPrompt("");
    setPreview(null);
    setSessionId(null);
    setChatMessage("");
    setTurns([]);
    setDraftVersion(null);
    setSkuQuery({});
    setCanUndo(false);
    setPlan(null);
    setHeaderOpen(false);
    setActiveLine(null);
  }

  function beginPlan(steps) {
    clearPlanTimer();
    const next = { steps, cursor: 0 };
    planRef.current = next;
    setPlan(next);
    steps.forEach((_, index) => {
      if (index === 0) return;
      planTimer.current.push(
        setTimeout(() => {
          setPlan((prev) => {
            if (!prev) return prev;
            const updated = { ...prev, cursor: Math.max(prev.cursor, index) };
            planRef.current = updated;
            return updated;
          });
        }, index * 800),
      );
    });
  }

  function endPlan() {
    clearPlanTimer();
    planRef.current = null;
    setPlan(null);
    setTurns((prev) => prev.filter((turn) => turn.role !== "plan"));
  }

  function patchHeader(patch) {
    onHeaderChange?.({
      issueDate: issueDate || "",
      receivedDate: receivedDate || "",
      recipientUnitId,
      slipNote: slipNote || "",
      ...patch,
    });
  }

  function scrollWork(index) {
    setActiveLine(index);
    setTimeout(() => {
      const root = workRef.current;
      if (!root) return;
      if (index == null) {
        root.scrollTo({ top: root.scrollHeight, behavior: "smooth" });
        return;
      }
      root.querySelector(`[data-line-index="${index}"]`)?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    }, 60);
  }

  function askNext(lines) {
    if (activeRef.current) return;
    const openIndex = (lines || []).findIndex((line) => !line.commodityId);
    if (openIndex >= 0) {
      scrollWork(openIndex);
      return;
    }
    const next =
      [...ruleQuestions(lines), ...userAskQuestions(lines), ...appliedQuestions(lines)].find(
        (item) => !askedRef.current.includes(item.key),
      ) ||
      (!askedRef.current.includes("closing")
        ? { key: "closing", lineIndex: null, draftLineId: null, text: CLOSING_QUESTION }
        : null);
    if (!next) return;
    askedRef.current = [...askedRef.current, next.key];
    activeRef.current = next;
    setTurns((prev) => [...prev, { role: "assistant", text: next.text }]);
    scrollWork(next.lineIndex);
  }

  useEffect(() => {
    if (!open) {
      resetDialog();
    }
    return () => clearPlanTimer();
  }, [open]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, plan]);

  if (!open) {
    return null;
  }

  const sending = suggesting || chatting || proposing || applyingChat;
  const busy = sending || undoing || committing || patching;
  const draftId = preview?.meta?.draftId ?? null;
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
      const merged = mergeDraftLines(preview, data);
      const lines = merged.lines.map((line, i) => {
        if (i !== index) return line;
        const stockUom = choice.measureUnit || line.stockUom || null;
        const written = line.writtenUom;
        return {
          ...line,
          stockUom,
          askRule: Boolean(
            line.needsConfirm && written && stockUom && !sameUnit(written, stockUom),
          ),
        };
      });
      const next = { ...merged, lines };
      setPreview(next);
      setSkuQuery((prev) => ({ ...prev, [index]: "" }));
      askNext(lines);
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
    setTurns([{ role: "user", text: trimmed }]);
    beginPlan(SUGGEST_PLAN);
    const run = beginRun("suggest", trimmed);
    try {
      const data = await suggestAi({
        signal: run.signal,
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
      if (!stillRunning(run.id)) return;
      runRef.current = null;
      const next = normalizePreview(data);
      endPlan();
      setSessionId(data?.sessionId ?? null);
      setDraftVersion(data?.meta?.draftVersion ?? null);
      setSkuQuery({});
      setPreview(next);
      setChatMessage("");
      setCanUndo(false);
      setTurns((prev) => [...prev, { role: "assistant", text: summaryText(next?.lines) }]);
      askNext(next?.lines || []);
    } catch (e) {
      if (!stillRunning(run.id) || isCanceled(e)) return;
      runRef.current = null;
      endPlan();
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
    const question = activeRef.current;
    const focusIndex = question?.lineIndex ?? null;
    setTurns((prev) => [...prev, { role: "user", text: trimmed }]);
    setChatMessage("");
    if ((question?.key === "closing" || question?.kind === "applied") && isDecline(trimmed)) {
      activeRef.current = null;
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            question.kind === "applied"
              ? "Giữ nguyên quy đổi này."
              : "Được. Bấm Áp dụng khi muốn đưa vào phiếu.",
        },
      ]);
      askNext(preview.lines);
      if (question.key === "closing" && !activeRef.current) scrollWork(null);
      return;
    }
    const run = beginRun("chat", trimmed);
    beginPlan(CHAT_PLAN);
    try {
      let nextPreview = preview;
      if (preview?.meta?.draftId) {
        const lineIds = question?.draftLineId
          ? [question.draftLineId]
          : (preview.lines || [])
              .filter((line) => line.commodityId && line.draftLineId)
              .map((line) => line.draftLineId);
        if (!lineIds.length) {
          runRef.current = null;
          endPlan();
          notifyError("Chốt mặt hàng trước khi ghi quy tắc");
          return;
        }
        const proposed = await proposeChat({
          signal: run.signal,
          id: preview.meta.draftId,
          unitId,
          message: trimmed,
          lineIds,
        }).unwrap();
        if (!stillRunning(run.id)) return;
        const hasChange = (proposed.diff || []).length > 0 || Boolean(proposed.ruleSuggestion);
        if (hasChange && proposed.turnId) {
          const data = await applyChat({
            signal: run.signal,
            id: preview.meta.draftId,
            unitId,
            version: draftVersion,
            turnId: proposed.turnId,
          }).unwrap();
          if (!stillRunning(run.id)) return;
          nextPreview = mergeDraftLines(preview, data);
          setPreview(nextPreview);
          setDraftVersion(data?.version ?? draftVersion);
          setCanUndo(true);
        }
        endPlan();
        const note = hasChange
          ? qtyRuleLabel(proposed.ruleSuggestion) || proposed.explanation || "Đã cập nhật dòng hàng."
          : proposed.explanation || "Chưa đổi được dòng nào. Gửi lại quy tắc.";
        setTurns((prev) => [...prev, { role: "assistant", text: note }]);
        if (!hasChange) {
          scrollWork(focusIndex);
          return;
        }
      } else {
        const data = await chatAi({
          signal: run.signal,
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
        if (!stillRunning(run.id)) return;
        const normalized = normalizePreview(data);
        nextPreview = normalized
          ? { ...normalized, meta: mergePreviewMeta(preview?.meta, normalized.meta) }
          : preview;
        setPreview(nextPreview);
        endPlan();
        setTurns((prev) => [...prev, { role: "assistant", text: "Đã cập nhật dòng hàng." }]);
      }
      runRef.current = null;
      activeRef.current = null;
      scrollWork(focusIndex);
      askNext(nextPreview?.lines || []);
    } catch (e) {
      if (!stillRunning(run.id) || isCanceled(e)) return;
      runRef.current = null;
      endPlan();
      notifyError(e?.data?.message ?? "Giữ nguyên bản nháp. Hãy gửi lại quy tắc.");
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
        confirmAll: false,
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

  const draftText = preview ? chatMessage : prompt;
  const sendDisabled = busy || (preview ? !chatMessage.trim() : prompt.trim().length < 3);
  const recipientName =
    recipientOptions.find((item) => String(item.id) === String(recipientUnitId))?.name ||
    recipientLabel ||
    "—";
  const headerLine = `Giao ${displayYmd(issueDate)} · Nhận ${displayYmd(receivedDate)} · ${recipientName} · ${String(slipNote || "").trim() || "Không ghi chú"}`;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
      <div className="flex h-[min(88vh,860px)] w-full max-w-6xl flex-col rounded-lg border border-border bg-card shadow-xl">
        <div className="border-b border-border px-4 py-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold">AI gợi ý phiếu</h3>
              <p className="truncate text-xs text-muted-foreground">{headerLine}</p>
            </div>
            <Button type="button" variant="outline" onClick={() => setHeaderOpen((open) => !open)} disabled={busy}>
              {headerOpen ? "Đóng" : "Sửa header"}
            </Button>
          </div>
          {headerOpen ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-xs">
                Ngày giao
                <input
                  type="date"
                  className={inputClass}
                  value={issueDate || ""}
                  disabled={busy}
                  onChange={(e) => {
                    const next = e.target.value;
                    const received =
                      !receivedDate || receivedDate === issueDate ? next : receivedDate;
                    patchHeader({ issueDate: next, receivedDate: received });
                  }}
                />
              </label>
              <label className="space-y-1 text-xs">
                Ngày nhận
                <input
                  type="date"
                  className={inputClass}
                  value={receivedDate || ""}
                  disabled={busy}
                  onChange={(e) => patchHeader({ receivedDate: e.target.value })}
                />
              </label>
              {canPickRecipient ? (
                <label className="space-y-1 text-xs sm:col-span-2">
                  Đơn vị nhận
                  <select
                    className={inputClass}
                    value={String(recipientUnitId ?? "")}
                    disabled={busy}
                    onChange={(e) => patchHeader({ recipientUnitId: Number(e.target.value) })}
                  >
                    {recipientOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name || `Đơn vị #${item.id}`}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="text-xs text-muted-foreground sm:col-span-2">Đơn vị nhận: {recipientName}</p>
              )}
              <label className="space-y-1 text-xs sm:col-span-2">
                Ghi chú
                <textarea
                  className={`${inputClass} min-h-[2.5rem] resize-y`}
                  rows={2}
                  maxLength={500}
                  value={slipNote || ""}
                  disabled={busy}
                  onChange={(e) => patchHeader({ slipNote: e.target.value })}
                />
              </label>
            </div>
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <section className="flex h-[46%] min-h-0 w-full shrink-0 flex-col border-b border-border md:h-full md:w-[min(42%,34rem)] md:min-w-[22rem] md:border-b-0 md:border-r">
            <header className="border-b border-border px-3 py-2 text-sm font-semibold">Trao đổi</header>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3" data-local-scroll="true">
              {turns.length === 0 && !plan ? (
                <p className="text-xs text-muted-foreground">
                  Gửi tin đặt hàng. AI đọc, chấm điểm, rồi hỏi phần còn thiếu.
                </p>
              ) : null}
              {turns.map((turn, i) => (
                <div
                  key={`${turn.role}-${i}`}
                  className={
                    turn.role === "user"
                      ? "ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "mr-10 max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm"
                  }
                >
                  {turn.text}
                </div>
              ))}
              {plan ? (
                <div className="mr-8 rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm">
                  <ul className="space-y-1">
                    {plan.steps.map((step, i) => {
                      const done = i < plan.cursor;
                      const run = i === plan.cursor;
                      return (
                        <li key={step} className={done ? "text-muted-foreground" : run ? "font-medium" : "text-muted-foreground/60"}>
                          {done ? "✓ " : ""}
                          {step}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              <div ref={chatEndRef} />
            </div>
            <div className="space-y-2 border-t border-border p-3">
              <div className="relative">
                <textarea
                  className={`${inputClass} max-h-40 min-h-[5.5rem] resize-y pb-12 pr-12`}
                  rows={4}
                  maxLength={2000}
                  value={draftText}
                  onChange={(e) => (preview ? setChatMessage(e.target.value) : setPrompt(e.target.value))}
                  placeholder={preview ? "Ví dụ: 10 quả = 1 vỉ" : "Ví dụ: trứng vịt: 15 quả"}
                  disabled={busy}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!sending) void (preview ? handleChat() : handleSuggest());
                    }
                  }}
                />
                <button
                  type="button"
                  aria-label={sending ? "Dừng" : "Gửi"}
                  className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm disabled:opacity-40"
                  disabled={!sending && sendDisabled}
                  onClick={() => {
                    if (sending) stopSend();
                    else void (preview ? handleChat() : handleSuggest());
                  }}
                >
                  {sending ? <Pause className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              {draftId && canUndo ? (
                <Button type="button" variant="outline" onClick={() => void handleUndoChat()} disabled={busy}>
                  Hoàn tác
                </Button>
              ) : null}
            </div>
          </section>
          <section ref={workRef} className="min-h-0 flex-1 overflow-y-auto" data-local-scroll="true">
          {preview ? (
            <>
              <section className="m-3 rounded-md border border-border">
                <header className="border-b border-border bg-muted/30 px-3 py-1.5 text-sm font-semibold">
                  Dòng hàng
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground">
                        <th className="px-3 py-1.5 font-medium">LTTP</th>
                        <th className="px-3 py-1.5 font-medium">Mã</th>
                        <th className="px-3 py-1.5 font-medium">SL</th>
                        <th className="px-3 py-1.5 font-medium">Đơn giá</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(preview.lines || []).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-2 text-xs text-muted-foreground">
                            Không có dòng gợi ý
                          </td>
                        </tr>
                      ) : (
                        preview.lines.map((line, i) => {
                          const needs = lineStatusLabel(line) === "cần xác nhận";
                          const matches = catalogMatches(catalog, skuQuery[i]);
                          const pct = Number(line.confidence);
                          const choiceCard = (choice, source) => (
                            <button
                              key={choice.commodityId ?? choice.id}
                              type="button"
                              className="rounded-lg border border-primary/50 bg-primary/10 px-2.5 py-1.5 text-left text-xs font-medium text-foreground shadow-sm hover:bg-primary/20 disabled:opacity-50"
                              disabled={busy}
                              onClick={() => void pickChoice(i, choice, source)}
                            >
                              {choice.name}
                            </button>
                          );
                          return (
                          <tr
                            key={line.draftLineId ?? i}
                            data-line-index={i}
                            className={
                              activeLine === i
                                ? "border-t border-primary/50 bg-primary/10"
                                : needs
                                  ? "border-t border-amber-500/40 bg-amber-500/10"
                                  : "border-t border-border/50"
                            }
                          >
                            <td className="px-3 py-1 align-top">
                              <div>{line.commodityName || line.rawName || "—"}</div>
                              <div className="text-[11px] text-muted-foreground">
                                <span className={needs ? "font-medium text-amber-800 dark:text-amber-200" : ""}>
                                  {lineStatusLabel(line)}
                                </span>
                                {Number.isFinite(pct) ? (
                                  <span className={confidenceClass(pct)}>
                                    {` · ${Math.round(pct * 100)}%`}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1 space-y-1">
                                {line.commodityId ? (
                                  <button
                                    type="button"
                                    className="text-[11px] text-primary"
                                    disabled={busy}
                                    onClick={() => {
                                      const lines = withUserAsk(preview.lines, i);
                                      const next = { ...preview, lines };
                                      setPreview(next);
                                      if (!activeRef.current) askNext(lines);
                                    }}
                                  >
                                    Chưa đúng
                                  </button>
                                ) : null}
                                {needs && (line.choices || []).length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5 rounded-lg border border-primary/40 bg-primary/5 p-1.5">
                                    {(line.choices || []).slice(0, 3).map((choice) => choiceCard(choice, "choice"))}
                                  </div>
                                ) : null}
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
                                  <div className="flex flex-wrap gap-1.5">
                                    {matches.map((item) =>
                                      choiceCard(
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
                                      ),
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-3 py-1 align-top font-mono text-xs">{line.code || "—"}</td>
                            <td className="px-3 py-1 align-top tabular-nums">
                              <div>
                                {line.quantity ?? "—"}
                                {line.commodityId && line.writtenUom ? ` (${line.writtenUom})` : ""}
                                {line.commodityId && !line.writtenUom && line.measureUnit
                                  ? ` ${line.measureUnit}`
                                  : ""}
                              </div>
                              {line.lineNote ? (
                                <div className="text-[11px] text-muted-foreground">{line.lineNote}</div>
                              ) : null}
                              {line.commodityId && needs && line.writtenUom ? (
                                <div className="text-[11px] text-amber-800 dark:text-amber-200">
                                  Chat quy tắc cho «{line.writtenUom}»
                                </div>
                              ) : null}
                            </td>
                            <td className="px-3 py-1 align-top tabular-nums text-muted-foreground">
                              {line.unitPrice != null ? formatVnd(line.unitPrice) : "—"}
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
          ) : (
            <p className="p-6 text-sm text-muted-foreground">Kết quả gợi ý hiện ở đây.</p>
          )}
          </section>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={busy}>
            Hủy
          </Button>
          <Button type="button" onClick={() => void handleApply()} disabled={busy || !preview || pendingConfirm}>
            {committing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Áp dụng
          </Button>
        </div>
      </div>
    </div>
  );
}
