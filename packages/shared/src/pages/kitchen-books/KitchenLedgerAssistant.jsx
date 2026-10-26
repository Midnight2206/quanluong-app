"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  useAddLedgerAssistantMemoryMutation,
  useApplyLedgerAssistantMutation,
  useDeleteLedgerAssistantMemoryMutation,
  useDeleteLedgerAssistantRuleMutation,
  useGetKitchenLedgerAssistantQuery,
  useLedgerAssistantTurnMutation,
  useSaveLedgerAssistantProfileMutation,
} from "@/features/kitchen-books/api/kitchenBooksApi";
import { notifyError, notifySuccess } from "@/services/notify";
import { cn } from "@/utils/cn";
import { fieldClassSm } from "@/utils/fieldClass";
import { Note } from "./KitchenLedgerEntry.jsx";

const MEALS = [["sang", "Sáng"], ["trua", "Trưa"], ["chieu", "Chiều"]];
const EXTRAS = [["benhXa", "Bệnh xá"], ["benhNhan", "Bệnh nhân"], ["omTrai", "Ốm"], ["leTet", "Lễ tết"]];
const INTENTS = [["", "Tự nhận"], ["headcount", "Quân số"], ["movement", "Hàng"], ["rule", "Quy tắc"], ["question", "Hỏi sổ"]];

function ScheduleDraft({ message, onApply, busy, showContent }) {
  const rows = message.payloadJson?.schedules || [];
  return (
    <div className="flex flex-col gap-2">
      {showContent ? <p>{message.content}</p> : null}
      {rows.map((row) => (
        <p key={row.date} className="text-xs">{row.date}: {row.text}</p>
      ))}
      <Button variant="primary" disabled={busy || !rows.length} onClick={onApply}>Ghi lịch làm việc</Button>
    </div>
  );
}

function errText(error) {
  const data = error?.data;
  if (data && typeof data === "object" && data.message) return data.message;
  if (typeof data === "string") return data;
  if (error?.message) return error.message;
  return "Không thực hiện được.";
}

function low(score) {
  return Number(score) < 0.8;
}

function HeadcountDraft({ message, days, onChange, onApply, busy }) {
  return (
    <div className="flex flex-col gap-2">
      <p>{message.content}</p>
      {days.map((day) => (
        <div key={day.date} className="rounded-lg border border-border p-2">
          <p className="mb-1 font-medium">{day.date}</p>
          {day.source ? <p className="mb-1 text-muted-foreground">“{day.source}”</p> : null}
          {(day.warnings || []).map((warning) => <Note key={warning} tone="warn">{warning}</Note>)}
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 pr-2 font-medium">Mức</th>
                {MEALS.map(([key, label]) => <th key={key} className="py-1 pr-2 font-medium">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {day.headcount.levels.map((level) => {
                const score = (day.confidence?.levels || []).find((row) => Number(row.dailyAmount) === Number(level.dailyAmount));
                return (
                  <tr key={level.dailyAmount}>
                    <td className="py-1 pr-2">{level.dailyAmount}</td>
                    {MEALS.map(([key]) => (
                      <td key={key} className="py-1 pr-2">
                        <input
                          aria-label={`${day.date} ${level.dailyAmount} ${key}`}
                          inputMode="numeric"
                          className={cn(fieldClassSm, "w-16", low(score?.[key]) && "bg-amber-500/15")}
                          value={level[key]}
                          onChange={(event) => onChange(day.date, level.dailyAmount, key, event.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
      <Button variant="primary" disabled={busy} onClick={onApply}>Ghi quân số</Button>
    </div>
  );
}

function MovementDraft({ message, lines, onChange, onApply, busy }) {
  const savable = lines.some((line) => line.savable);
  return (
    <div className="flex flex-col gap-2">
      {message.content ? <p>{message.content}</p> : null}
      {lines.map((line, index) => (
        <div key={`${line.name}-${index}`} className={cn("rounded-lg border border-border p-2 text-xs", low(line.confidence) && "bg-amber-500/15")}>
          <p className="font-medium">{line.name} · {line.place || "Dòng hàng"}{line.measureUnit ? ` · ${line.measureUnit}` : ""}</p>
          {line.sourceSnippet ? <p className="text-muted-foreground">“{line.sourceSnippet}”</p> : null}
          {line.warning ? <Note tone="warn">{line.warning}</Note> : null}
          {line.priceNote ? <p className="text-muted-foreground">{line.priceNote}</p> : null}
          {line.savable ? (
            <label className="mt-1 flex items-center gap-2">
              Số lượng
              <input
                aria-label={`Số lượng ${line.name}`}
                inputMode="decimal"
                className={cn(fieldClassSm, "w-24")}
                value={line.qty}
                onChange={(event) => onChange(index, "qty", event.target.value)}
              />
            </label>
          ) : null}
        </div>
      ))}
      <Button variant="primary" disabled={busy || !savable} onClick={onApply}>Ghi dòng đã khớp</Button>
    </div>
  );
}

export function KitchenLedgerAssistant({ unitId, date }) {
  const { data, error, isLoading } = useGetKitchenLedgerAssistantQuery({ unitId, date });
  const [turn, turnState] = useLedgerAssistantTurnMutation();
  const [applyDraft, applyState] = useApplyLedgerAssistantMutation();
  const [saveProfile, profileState] = useSaveLedgerAssistantProfileMutation();
  const [addMemory, memoryState] = useAddLedgerAssistantMemoryMutation();
  const [removeMemory] = useDeleteLedgerAssistantMemoryMutation();
  const [removeRule] = useDeleteLedgerAssistantRuleMutation();
  const [text, setText] = useState("");
  const [intent, setIntent] = useState("");
  const [image, setImage] = useState(null);
  const [ruleTitle, setRuleTitle] = useState("");
  const [openPrefs, setOpenPrefs] = useState(false);
  const [edits, setEdits] = useState({});
  const [name, setName] = useState("Trợ lý làm sổ");
  const [tone, setTone] = useState("ngan_gon");
  const [preferred, setPreferred] = useState("either");
  const [threshold, setThreshold] = useState("");
  const [fact, setFact] = useState("");
  const imageRef = useRef(null);
  const ruleRef = useRef(null);
  const busy = turnState.isLoading || applyState.isLoading;

  useEffect(() => {
    const profile = data?.profile;
    if (!profile) return;
    setName(profile.displayName || "Trợ lý làm sổ");
    setTone(profile.tone || "ngan_gon");
    setPreferred(profile.preferences?.preferredInput || "either");
    setThreshold(profile.preferences?.suggestThreshold ?? "");
  }, [data?.profile]);

  async function send() {
    if (!text.trim() && !image) {
      notifyError("Nhập nội dung hoặc chọn ảnh.");
      return;
    }
    const sendImage = intent !== "rule" && intent !== "question";
    try {
      await turn({
        unitId,
        date,
        text: text.trim() || undefined,
        intent: intent || undefined,
        ruleTitle: ruleTitle || undefined,
        imageBase64: sendImage ? image?.base64 : undefined,
        imageMime: sendImage ? image?.mime : undefined,
      }).unwrap();
      setText("");
      setImage(null);
      setRuleTitle("");
    } catch (err) {
      notifyError(errText(err));
    }
  }

function daysOf(message) {
  const stored = edits[message.id];
  if (stored && !Array.isArray(stored) && stored.days) return stored.days;
  if (Array.isArray(stored) && message.kind === "headcount_draft") return stored;
  return message.payloadJson?.days || [];
}

function linesOf(message) {
  const stored = edits[message.id];
  if (stored && !Array.isArray(stored) && stored.lines) return stored.lines;
  if (Array.isArray(stored) && message.kind !== "headcount_draft") return stored;
  return message.payloadJson?.lines || [];
}

  function changeMeal(message, dayDate, amount, meal, value) {
    const days = daysOf(message).map((day) => {
      if (day.date !== dayDate) return day;
      return {
        ...day,
        headcount: {
          ...day.headcount,
          levels: day.headcount.levels.map((level) => (
            Number(level.dailyAmount) === Number(amount) ? { ...level, [meal]: Number(value) || 0 } : level
          )),
        },
      };
    });
    setEdits((prev) => ({
      ...prev,
      [message.id]: message.kind === "records_draft"
        ? { days, lines: prev[message.id]?.lines || message.payloadJson?.lines || [] }
        : days,
    }));
  }

  async function applyHeadcount(message) {
    try {
      const result = await applyDraft({
        unitId,
        date,
        messageId: message.id,
        headcountDays: daysOf(message).map((day) => ({ date: day.date, headcount: day.headcount })),
      }).unwrap();
      const bad = (result.saved || []).filter((row) => !row.ok);
      if (bad.length) notifyError(bad.map((row) => `${row.date}: ${row.message}`).join(" "));
      else notifySuccess("Đã ghi quân số");
    } catch (err) {
      notifyError(errText(err));
    }
  }

  async function applyMovement(message) {
    const lines = linesOf(message).filter((line) => line.savable);
    try {
      const result = await applyDraft({
        unitId,
        date,
        messageId: message.id,
        movementLines: lines.map((line) => ({ name: line.name, qty: Number(line.qty), unitPrice: line.unitPrice })),
      }).unwrap();
      if (result.saved?.ok === false) notifyError(result.saved.message);
      else notifySuccess("Đã ghi dòng hàng");
    } catch (err) {
      notifyError(errText(err));
    }
  }

  async function applySchedule(message) {
    const rows = message.payloadJson?.schedules || [];
    try {
      const result = await applyDraft({
        unitId,
        date,
        messageId: message.id,
        schedules: rows.map((row) => ({ date: row.date, text: row.text })),
      }).unwrap();
      const bad = (result.saved || []).filter((row) => !row.ok);
      if (bad.length) notifyError(bad.map((row) => `${row.date}: ${row.message}`).join(" "));
      else notifySuccess("Đã ghi lịch làm việc");
    } catch (err) {
      notifyError(errText(err));
    }
  }

  async function applyRule(message) {
    try {
      await applyDraft({ unitId, date, messageId: message.id, acceptProposals: true }).unwrap();
      notifySuccess("Đã áp dụng cấu hình");
    } catch (err) {
      notifyError(errText(err));
    }
  }

  async function onRuleFile(file) {
    const body = await file.text();
    if (!file.name.match(/\.(md|txt)$/i) || body.length > 20_000) {
      notifyError("Chỉ nhận file .md hoặc .txt, tối đa 20.000 ký tự.");
      return;
    }
    setText(body);
    setIntent("rule");
    setRuleTitle(file.name.replace(/\.(md|txt)$/i, "").slice(0, 120));
  }

  function onImage(file) {
    if (!file || file.size > 4_000_000) {
      notifyError("Ảnh jpeg, png hoặc webp, tối đa 4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => notifyError("Ảnh không đọc được.");
    reader.onload = () => {
      const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(String(reader.result || ""));
      if (!match) {
        notifyError("Ảnh không đọc được.");
        return;
      }
      setImage({ mime: match[1], base64: match[2] });
      if (!intent) setIntent("headcount");
    };
    reader.readAsDataURL(file);
  }

  if (error) {
    return <Note tone="bad">{errText(error)} Nhập tay ở bảng phía dưới vẫn dùng được.</Note>;
  }

  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{data?.profile?.displayName || "Trợ lý làm sổ"}</h2>
        <Button variant="ghost" className="px-3 py-1" onClick={() => setOpenPrefs((open) => !open)}>
          {openPrefs ? "Đóng tuỳ chọn" : "Tuỳ chọn"}
        </Button>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Đang tải trợ lý…</p> : null}
      {data && !data.enabled ? (
        <Note>AI đang tắt. Vẫn hỏi sổ, gửi quy tắc và nhập tay được.</Note>
      ) : null}
      {(data?.brief || []).map((item) => <Note key={item.code + item.message} tone="warn">{item.message}</Note>)}
      {openPrefs && data ? (
        <div className="mb-2 grid gap-2 rounded-lg border border-border p-2 text-sm">
          <label className="flex flex-col gap-1">
            Tên trợ lý
            <input aria-label="Tên trợ lý" className={fieldClassSm} maxLength={40} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            Giọng
            <select aria-label="Giọng trợ lý" className={fieldClassSm} value={tone} onChange={(event) => setTone(event.target.value)}>
              <option value="ngan_gon">Ngắn gọn</option>
              <option value="than_mat">Thân mật</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Cách nhập hay dùng
            <select aria-label="Cách nhập" className={fieldClassSm} value={preferred} onChange={(event) => setPreferred(event.target.value)}>
              <option value="either">Tin nhắn hoặc ảnh</option>
              <option value="text">Tin nhắn</option>
              <option value="photo">Ảnh</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Gợi ý ngưỡng thừa thiếu
            <input aria-label="Gợi ý ngưỡng" inputMode="numeric" className={fieldClassSm} value={threshold} onChange={(event) => setThreshold(event.target.value)} />
          </label>
          <Button
            variant="secondary"
            disabled={profileState.isLoading}
            onClick={() => saveProfile({
              unitId,
              date,
              displayName: name.trim() || "Trợ lý làm sổ",
              tone,
              preferences: {
                preferredInput: preferred,
                ...(threshold === "" ? {} : { suggestThreshold: Number(threshold) }),
              },
            }).unwrap().then(() => notifySuccess("Đã lưu tuỳ chọn")).catch((err) => notifyError(errText(err)))}
          >
            Lưu tuỳ chọn
          </Button>
          <ul className="flex flex-col gap-1">
            {(data.memory || []).map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-2">
                <span>{row.fact}</span>
                <Button variant="ghost" className="px-2 py-1" onClick={() => removeMemory({ unitId, id: row.id, date }).unwrap().catch((err) => notifyError(errText(err)))}>Xóa</Button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input aria-label="Ghi nhớ mới" className={cn(fieldClassSm, "min-w-0 flex-1")} maxLength={240} value={fact} onChange={(event) => setFact(event.target.value)} />
            <Button
              variant="secondary"
              disabled={memoryState.isLoading || !fact.trim()}
              onClick={() => addMemory({ unitId, date, fact: fact.trim() }).unwrap().then(() => setFact("")).catch((err) => notifyError(errText(err)))}
            >
              Nhớ
            </Button>
          </div>
          <ul className="flex flex-col gap-1">
            {(data.rules || []).map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-2">
                <span>{row.title}</span>
                <Button variant="ghost" className="px-2 py-1" onClick={() => removeRule({ unitId, id: row.id, date }).unwrap().catch((err) => notifyError(errText(err)))}>Xóa</Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mb-2 flex max-h-80 flex-col gap-2 overflow-y-auto" data-local-scroll="true">
        {(data?.messages || []).map((message) => (
          <article key={message.id} className={cn("rounded-lg px-2 py-1 text-sm", message.role === "user" ? "bg-muted" : "bg-background")}>
            {message.kind === "headcount_draft" || (message.kind === "records_draft" && daysOf(message).length) ? (
              <HeadcountDraft
                message={message}
                days={daysOf(message)}
                busy={busy}
                onChange={(dayDate, amount, meal, value) => changeMeal(message, dayDate, amount, meal, value)}
                onApply={() => applyHeadcount(message)}
              />
            ) : null}
            {message.kind === "movement_draft" || (message.kind === "records_draft" && linesOf(message).length) ? (
              <MovementDraft
                message={message.kind === "records_draft" ? { ...message, content: "" } : message}
                lines={linesOf(message)}
                busy={busy}
                onChange={(index, key, value) => {
                  const lines = linesOf(message).map((line, i) => (i === index ? { ...line, [key]: value } : line));
                  setEdits((prev) => ({
                    ...prev,
                    [message.id]: message.kind === "records_draft"
                      ? { days: prev[message.id]?.days || message.payloadJson?.days || [], lines }
                      : lines,
                  }));
                }}
                onApply={() => applyMovement(message)}
              />
            ) : null}
            {message.kind === "schedule_draft" || (message.kind === "records_draft" && (message.payloadJson?.schedules || []).length) ? (
              <ScheduleDraft
                message={message}
                busy={busy}
                showContent={message.kind === "schedule_draft"}
                onApply={() => applySchedule(message)}
              />
            ) : null}
            {message.kind === "rule_note" || (message.kind === "records_draft" && (message.payloadJson?.proposals || []).length) ? (
              <div className="flex flex-col gap-2">
                {message.kind === "rule_note" ? <p>{message.content}</p> : null}
                {(message.payloadJson?.proposals || []).length ? (
                  <Button variant="primary" disabled={busy || message.payloadJson.accepted} onClick={() => applyRule(message)}>
                    Áp dụng cấu hình
                  </Button>
                ) : null}
              </div>
            ) : null}
            {message.kind !== "headcount_draft" && message.kind !== "movement_draft" && message.kind !== "records_draft" && message.kind !== "rule_note" && message.kind !== "schedule_draft" ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : null}
          </article>
        ))}
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {INTENTS.map(([value, label]) => (
          <Button key={label} variant={intent === value ? "primary" : "ghost"} className="px-3 py-1" onClick={() => setIntent(value)}>
            {label}
          </Button>
        ))}
      </div>
      <textarea
        aria-label="Nội dung gửi trợ lý"
        className={cn(fieldClassSm, "mb-2 min-h-20 w-full")}
        maxLength={20000}
        value={text}
        placeholder="18/10: 91 97 97 · 0 0 0, mua ngoài 5kg mực, lịch làm việc trực sáng, hoặc hỏi thừa thiếu"
        onChange={(event) => setText(event.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <input ref={imageRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => onImage(event.target.files?.[0])} />
        <input ref={ruleRef} type="file" accept=".md,.txt,text/plain,text/markdown" className="hidden" onChange={(event) => event.target.files?.[0] && onRuleFile(event.target.files[0])} />
        <Button variant="ghost" className="px-3 py-1" onClick={() => imageRef.current?.click()}>Ảnh quân số</Button>
        <Button variant="ghost" className="px-3 py-1" onClick={() => ruleRef.current?.click()}>File quy tắc</Button>
        {image ? <span className="text-xs text-muted-foreground">Đã chọn ảnh</span> : null}
        {ruleTitle ? <span className="text-xs text-muted-foreground">{ruleTitle}</span> : null}
        <Button variant="primary" disabled={busy} onClick={send}>Gửi</Button>
      </div>
    </section>
  );
}

export function KitchenLedgerAssistantBubble({ unitId, date }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Trợ lý làm sổ">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Đóng trợ lý" onClick={() => setOpen(false)} />
          <div className="relative z-10 flex max-h-[min(42rem,calc(100dvh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-card shadow-float">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <h2 className="text-sm font-semibold">Trợ lý làm sổ</h2>
              <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setOpen(false)}>Đóng</Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3" data-local-scroll="true">
              <KitchenLedgerAssistant unitId={unitId} date={date} />
            </div>
          </div>
        </div>
      ) : null}
      {open ? null : (
        <button
          type="button"
          className="ledger-assistant-bubble fixed bottom-6 right-6 z-50 flex h-14 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg print:hidden"
          aria-expanded={false}
          aria-label="Mở trợ lý làm sổ"
          onClick={() => setOpen(true)}
        >
          <span aria-hidden="true" className="text-lg leading-none">✦</span>
          Trợ lý
        </button>
      )}
    </>
  );
}
