"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { WorkspacePanelCard } from "@/components/common/WorkspacePanelCard";

export { WorkspacePanelCard as ChungTuExportWizardCard };

export const CHUNG_TU_EXPORT_WIZARD_STEPS = [
  { id: "params", label: "Tham số & mẫu" },
  { id: "map", label: "Map & tạo Sheet" },
];

export function ChungTuExportWizardStepper({ stepIndex, className }) {
  return (
    <nav
      aria-label="Các bước xuất chứng từ"
      className={cn("print:hidden", className)}
    >
      <ol className="flex items-center gap-2">
        {CHUNG_TU_EXPORT_WIZARD_STEPS.map((s, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <li key={s.id} className="flex min-w-0 flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-center transition-colors",
                  active && "bg-primary/10 ring-1 ring-primary/20",
                  done && !active && "opacity-85",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
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
                    "w-full text-[10px] font-medium leading-tight",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < CHUNG_TU_EXPORT_WIZARD_STEPS.length - 1 ? (
                <div
                  className={cn(
                    "h-px w-4 shrink-0 sm:w-8",
                    i < stepIndex ? "bg-primary/50" : "bg-border",
                  )}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Bước {stepIndex + 1}/{CHUNG_TU_EXPORT_WIZARD_STEPS.length}:{" "}
        <span className="font-medium text-foreground">
          {CHUNG_TU_EXPORT_WIZARD_STEPS[stepIndex]?.label}
        </span>
      </p>
    </nav>
  );
}

export function ChungTuExportWizardFooter({
  stepIndex,
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Tiếp theo",
  children,
  className,
}) {
  const isFirst = stepIndex <= 0;
  const isLast = stepIndex >= CHUNG_TU_EXPORT_WIZARD_STEPS.length - 1;

  return (
    <div
      className={cn(
        "print:hidden sticky bottom-0 z-10 -mx-4 space-y-2 border-t border-border/80 bg-background/95 px-4 py-2.5 backdrop-blur-sm sm:-mx-4 sm:px-4",
        className,
      )}
    >
      {children ? <div className="flex flex-col gap-2">{children}</div> : null}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-10 flex-1 gap-1 text-xs sm:flex-none sm:px-4"
          disabled={isFirst}
          onClick={onBack}
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          Quay lại
        </Button>
        {!isLast ? (
          <Button
            type="button"
            className="h-10 flex-[2] gap-1.5 text-xs sm:flex-none sm:px-5"
            disabled={nextDisabled}
            onClick={onNext}
          >
            {nextLabel}
            <ChevronRight className="size-3.5" aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
