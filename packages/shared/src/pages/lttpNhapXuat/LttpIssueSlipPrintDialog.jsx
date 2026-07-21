"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { usePutLttpIssueFormDefaultsMutation } from "@/features/lttp/api/lttpApi";
import { notifyError, notifySuccess } from "@/services/notify";
import { LttpIssueSlipPrintDocument } from "./LttpIssueSlipPrintDocument";
import {
  LTTP_PRINT_FONT_CHOICES,
  buildLttpIssueSlipPrintJob,
  coercePrintFontSizePt,
  collectLttpIssueSlipPrintParamsFromApiSlip,
  registerLttpIssueSlipLivePrintJob,
  resolveLttpPrintFont,
} from "./lttpIssueSlipPrint";

const inputClass =
  "w-full min-w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary sm:text-sm";

/**
 * Chỉnh mẫu in + xem trước trước khi in phiếu đã lưu (tab Lịch sử xuất kho).
 */
export function LttpIssueSlipPrintDialog({
  open,
  onClose,
  apiSlip,
  storageUnitId,
  canWrite = false,
}) {
  const [printHeaderLine1, setPrintHeaderLine1] = useState("");
  const [printHeaderLine2, setPrintHeaderLine2] = useState("");
  const [formMauSo, setFormMauSo] = useState("");
  const [warehouseFrom, setWarehouseFrom] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [signerWriter, setSignerWriter] = useState("");
  const [signerRecipient, setSignerRecipient] = useState("");
  const [signerApprover, setSignerApprover] = useState("");
  const [marginTop, setMarginTop] = useState(2);
  const [marginRight, setMarginRight] = useState(1.5);
  const [marginBottom, setMarginBottom] = useState(1.5);
  const [marginLeft, setMarginLeft] = useState(3);
  const [printFontId, setPrintFontId] = useState("times");
  const [printFontSizePt, setPrintFontSizePt] = useState(12);

  const [putFormDefaults, { isLoading: putDefBusy }] =
    usePutLttpIssueFormDefaultsMutation();

  useEffect(() => {
    if (!open || !apiSlip) {
      return;
    }
    const p = collectLttpIssueSlipPrintParamsFromApiSlip(apiSlip);
    setPrintHeaderLine1(p.printHeaderLine1 ?? "");
    setPrintHeaderLine2(p.printHeaderLine2 ?? "");
    setFormMauSo(p.formMauSo ?? "");
    setWarehouseFrom(p.warehouseFrom ?? "");
    setRecipientName(p.recipientName ?? "");
    setSignerWriter(p.signerWriter ?? "");
    setSignerRecipient(p.signerRecipient ?? "");
    setSignerApprover(p.signerApprover ?? "");
    setMarginTop(p.marginTop ?? 2);
    setMarginRight(p.marginRight ?? 1.5);
    setMarginBottom(p.marginBottom ?? 1.5);
    setMarginLeft(p.marginLeft ?? 3);
    setPrintFontId(p.printFontId ?? "times");
    setPrintFontSizePt(p.printFontSizePt ?? 12);
  }, [open, apiSlip]);

  const printJob = useMemo(() => {
    if (!apiSlip) {
      return null;
    }
    const base = collectLttpIssueSlipPrintParamsFromApiSlip(apiSlip);
    return buildLttpIssueSlipPrintJob({
      ...base,
      printHeaderLine1,
      printHeaderLine2,
      formMauSo,
      warehouseFrom,
      recipientName,
      signerWriter,
      signerRecipient,
      signerApprover,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
      printFontId,
      printFontSizePt,
    });
  }, [
    apiSlip,
    formMauSo,
    marginBottom,
    marginLeft,
    marginRight,
    marginTop,
    printFontId,
    printFontSizePt,
    printHeaderLine1,
    printHeaderLine2,
    recipientName,
    signerApprover,
    signerRecipient,
    signerWriter,
    warehouseFrom,
  ]);

  const printFont = resolveLttpPrintFont(printFontId);

  useEffect(() => {
    if (!open) {
      registerLttpIssueSlipLivePrintJob(null);
      return undefined;
    }
    registerLttpIssueSlipLivePrintJob(printJob);
    return () => registerLttpIssueSlipLivePrintJob(null);
  }, [open, printJob]);

  if (!open || !apiSlip || !printJob) {
    return null;
  }

  const slipLabel = `Quyển ${apiSlip.bookMmyy ?? "—"} — Số ${apiSlip.slipNo != null ? String(apiSlip.slipNo).padStart(4, "0") : "—"}`;

  async function saveUnitPrintDefaults() {
    if (!storageUnitId) {
      return;
    }
    try {
      await putFormDefaults({
        unitId: storageUnitId,
        printLine1: printHeaderLine1,
        printLine2: printHeaderLine2,
        formMauSo,
        warehouseFrom,
        marginTopCm: marginTop,
        marginRightCm: marginRight,
        marginBottomCm: marginBottom,
        marginLeftCm: marginLeft,
        printFontId,
        printFontSizePt,
        signerWriter,
        signerApprover,
      });
      notifySuccess("Đã lưu cấu hình mẫu in theo đơn vị.");
    } catch (err) {
      notifyError(
        err?.data?.message || err?.message || "Lưu mẫu in không thành công.",
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-background/80 backdrop-blur-[1px]"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lttp-ls-print-dialog-title"
        className="relative flex max-h-dvh w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-lg sm:max-h-[44rem] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 pb-3 pt-4 sm:px-5">
          <div className="min-w-0 space-y-0.5">
            <p
              id="lttp-ls-print-dialog-title"
              className="text-[10px] font-semibold uppercase tracking-wide text-primary"
            >
              Chỉnh &amp; in phiếu xuất
            </p>
            <p className="text-[11px] text-muted-foreground">
              {apiSlip.issueDate} · {slipLabel} ·{" "}
              {apiSlip.recipientUnit?.name ?? "—"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-8 gap-1.5 text-xs"
              onClick={() => window.print()}
            >
              <Printer className="size-3.5" />
              In / PDF
            </Button>
            <p className="hidden text-[9px] text-muted-foreground sm:block">
              Tỷ lệ in: 100%
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={onClose}
            >
              Đóng
            </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <div
            data-local-scroll="true"
            className="min-h-0 space-y-3 overflow-y-auto overscroll-contain border-b border-border p-4 lg:border-b-0 lg:border-r sm:p-5"
          >
            <p className="text-[10px] font-medium uppercase text-muted-foreground">
              Tuỳ chọn bản in
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <label className="text-[10px] text-muted-foreground">
                Lề trên (cm)
                <input
                  type="number"
                  step="0.1"
                  className={cn(inputClass, "mt-0.5")}
                  value={marginTop}
                  onChange={(e) => setMarginTop(Number(e.target.value))}
                />
              </label>
              <label className="text-[10px] text-muted-foreground">
                Lề phải (cm)
                <input
                  type="number"
                  step="0.1"
                  className={cn(inputClass, "mt-0.5")}
                  value={marginRight}
                  onChange={(e) => setMarginRight(Number(e.target.value))}
                />
              </label>
              <label className="text-[10px] text-muted-foreground">
                Lề dưới (cm)
                <input
                  type="number"
                  step="0.1"
                  className={cn(inputClass, "mt-0.5")}
                  value={marginBottom}
                  onChange={(e) => setMarginBottom(Number(e.target.value))}
                />
              </label>
              <label className="text-[10px] text-muted-foreground">
                Lề trái (cm)
                <input
                  type="number"
                  step="0.1"
                  className={cn(inputClass, "mt-0.5")}
                  value={marginLeft}
                  onChange={(e) => setMarginLeft(Number(e.target.value))}
                />
              </label>
            </div>
            <label className="block text-[10px] text-muted-foreground">
              Dòng 1 (đầu trái)
              <input
                className={cn(inputClass, "mt-0.5")}
                value={printHeaderLine1}
                onChange={(e) => setPrintHeaderLine1(e.target.value)}
              />
            </label>
            <label className="block text-[10px] text-muted-foreground">
              Dòng 2 (đầu trái)
              <input
                className={cn(inputClass, "mt-0.5")}
                value={printHeaderLine2}
                onChange={(e) => setPrintHeaderLine2(e.target.value)}
              />
            </label>
            <label className="block text-[10px] text-muted-foreground">
              Mẫu số (góc phải)
              <input
                className={cn(inputClass, "mt-0.5")}
                value={formMauSo}
                onChange={(e) => setFormMauSo(e.target.value)}
              />
            </label>
            <label className="block text-[10px] text-muted-foreground">
              Nhận tại kho
              <input
                className={cn(inputClass, "mt-0.5")}
                value={warehouseFrom}
                onChange={(e) => setWarehouseFrom(e.target.value)}
              />
            </label>
            <label className="block text-[10px] text-muted-foreground">
              Họ tên người nhận (trên bản in)
              <input
                className={cn(inputClass, "mt-0.5")}
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <label className="text-[10px] text-muted-foreground">
                Font chữ
                <select
                  className={cn(inputClass, "mt-0.5")}
                  value={printFontId}
                  onChange={(e) => setPrintFontId(e.target.value)}
                >
                  {LTTP_PRINT_FONT_CHOICES.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] text-muted-foreground">
                Cỡ chữ (pt)
                <input
                  type="number"
                  min={8}
                  max={18}
                  className={cn(inputClass, "mt-0.5")}
                  value={printFontSizePt}
                  onChange={(e) =>
                    setPrintFontSizePt(coercePrintFontSizePt(e.target.value))
                  }
                />
              </label>
            </div>
            <label className="block text-[10px] text-muted-foreground">
              Người viết phiếu (ký)
              <input
                className={cn(inputClass, "mt-0.5")}
                value={signerWriter}
                onChange={(e) => setSignerWriter(e.target.value)}
              />
            </label>
            <label className="block text-[10px] text-muted-foreground">
              Người nhận hàng (ký)
              <input
                className={cn(inputClass, "mt-0.5")}
                value={signerRecipient}
                onChange={(e) => setSignerRecipient(e.target.value)}
              />
            </label>
            <label className="block text-[10px] text-muted-foreground">
              Người duyệt (ký)
              <input
                className={cn(inputClass, "mt-0.5")}
                value={signerApprover}
                onChange={(e) => setSignerApprover(e.target.value)}
              />
            </label>
            {canWrite ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 w-full text-xs"
                disabled={!storageUnitId || putDefBusy}
                onClick={() => void saveUnitPrintDefaults()}
              >
                {putDefBusy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Lưu làm mẫu in đơn vị
              </Button>
            ) : null}
            <p className="text-[9px] leading-relaxed text-muted-foreground">
              Chỉnh trên đây chỉ áp dụng cho lần in này (trừ khi bấm «Lưu làm mẫu in đơn vị»).
              Sửa dòng hàng → dùng nút Sửa phiếu.
            </p>
          </div>

          <div
            data-local-scroll="true"
            className="min-h-0 overflow-auto bg-muted/30 p-3 sm:p-4"
          >
            <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Xem trước
            </p>
            <div
              className="mx-auto max-w-full bg-white text-black shadow-md"
              style={{
                width: "210mm",
                maxWidth: "100%",
                padding: `${marginTop}cm ${marginRight}cm ${marginBottom}cm ${marginLeft}cm`,
                fontFamily: printFont.value,
                fontSize: `${printFontSizePt}pt`,
                lineHeight: 1.35,
              }}
            >
              <LttpIssueSlipPrintDocument
                slip={printJob.slip}
                fontFamily={printFont.value}
                fontSizePt={printFontSizePt}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
