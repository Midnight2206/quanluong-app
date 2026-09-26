"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSuggestLttpIssueSlipAiMutation } from "@/features/lttp/api/lttpApi";
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

export function LttpIssueSlipAiSuggestDialog({
  open,
  onClose,
  unitId,
  issueDate,
  receivedDate,
  recipientUnitId,
  onApply,
}) {
  const [prompt, setPrompt] = useState("");
  const [preview, setPreview] = useState(null);
  const [suggestAi, { isLoading: suggesting }] = useSuggestLttpIssueSlipAiMutation();

  useEffect(() => {
    if (!open) {
      setPrompt("");
      setPreview(null);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const historyCount = preview?.meta?.historySampleCount ?? 0;
  const unmapped =
    preview?.lines?.filter((l) => !l?.mapped).length ?? 0;

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
      }).unwrap();
      setPreview(data);
    } catch (e) {
      notifyError(e?.data?.message ?? "Gợi ý AI thất bại");
    }
  }

  function handleApply() {
    if (!preview) {
      return;
    }
    onApply?.(preview);
    onClose?.();
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-border bg-card shadow-xl">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-semibold">AI gợi ý phiếu</h3>
          <p className="text-xs text-muted-foreground">
            {issueDate ? `Ngày phiếu: ${issueDate}` : "Tạo phiếu xuất mới"}
            {preview ? ` · mẫu lịch sử: ${historyCount}` : ""}
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
              disabled={suggesting}
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
                          <td colSpan={6} className="px-3 py-2 text-xs text-muted-foreground">
                            Không có dòng gợi ý
                          </td>
                        </tr>
                      ) : (
                        preview.lines.map((line, i) => (
                          <tr key={i} className="border-t border-border/50">
                            <td className="px-3 py-1 align-top">{line.commodityName || "—"}</td>
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
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={suggesting}>
            Hủy
          </Button>
          <Button type="button" variant="secondary" onClick={handleSuggest} disabled={suggesting}>
            {suggesting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Gợi ý
          </Button>
          <Button type="button" onClick={handleApply} disabled={suggesting || !preview}>
            Áp dụng
          </Button>
        </div>
      </div>
    </div>
  );
}
