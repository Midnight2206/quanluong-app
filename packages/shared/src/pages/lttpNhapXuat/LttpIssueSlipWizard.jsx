"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";

export const LTTP_ISSUE_SLIP_WIZARD_STEPS = [
  { id: "info", label: "Thông tin" },
  { id: "lines", label: "Mặt hàng" },
  { id: "review", label: "Xác nhận" },
];

export function LttpIssueSlipWizardStepper({ stepIndex, className }) {
  return (
    <nav
      aria-label="Các bước lập phiếu xuất"
      className={cn("print:hidden", className)}
    >
      <ol className="flex items-center gap-1">
        {LTTP_ISSUE_SLIP_WIZARD_STEPS.map((s, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <li key={s.id} className="flex min-w-0 flex-1 items-center gap-1">
              <div
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-center transition-colors",
                  active && "bg-primary/10",
                  done && !active && "opacity-80",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                    active
                      ? "bg-primary text-primary-foreground"
                      : done
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span
                  className={cn(
                    "w-full truncate text-[9px] font-medium leading-tight",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < LTTP_ISSUE_SLIP_WIZARD_STEPS.length - 1 ? (
                <div
                  className={cn(
                    "h-px w-2 shrink-0 sm:w-4",
                    i < stepIndex ? "bg-primary/50" : "bg-border",
                  )}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
        Bước {stepIndex + 1}/{LTTP_ISSUE_SLIP_WIZARD_STEPS.length}:{" "}
        <span className="font-medium text-foreground">
          {LTTP_ISSUE_SLIP_WIZARD_STEPS[stepIndex]?.label}
        </span>
      </p>
    </nav>
  );
}

export function LttpIssueSlipWizardFooter({
  stepIndex,
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Tiếp theo",
  showSubmit,
  submitLabel,
  submitBusy,
  submitDisabled,
  onSubmit,
  className,
}) {
  const isFirst = stepIndex <= 0;
  const isLast = stepIndex >= LTTP_ISSUE_SLIP_WIZARD_STEPS.length - 1;

  return (
    <div
      className={cn(
        "print:hidden sticky bottom-0 z-10 -mx-3 border-t border-border/80 bg-background/95 px-3 py-2 backdrop-blur-sm sm:-mx-4 sm:px-4",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-9 flex-1 gap-1 text-xs sm:flex-none sm:px-4"
          disabled={isFirst}
          onClick={onBack}
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          Quay lại
        </Button>
        {showSubmit && isLast ? (
          <Button
            type="button"
            className="h-9 flex-[2] gap-1.5 text-xs sm:flex-none sm:px-5"
            disabled={submitDisabled || submitBusy}
            onClick={onSubmit}
          >
            {submitBusy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : null}
            {submitLabel}
          </Button>
        ) : (
          <Button
            type="button"
            className="h-9 flex-[2] gap-1.5 text-xs sm:flex-none sm:px-5"
            disabled={isLast || nextDisabled}
            onClick={onNext}
          >
            {nextLabel}
            <ChevronRight className="size-3.5" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
