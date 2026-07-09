"use client";

import { cn } from "@/utils/cn";

/**
 * Card shell cho workspace — full width trên mobile khi `expanded`.
 */
export function WorkspacePanelCard({
  title,
  description,
  children,
  className,
  bodyClassName,
  expanded = false,
}) {
  return (
    <section
      className={cn(
        "min-w-0 border border-border/80 bg-card/50 shadow-sm",
        expanded
          ? "-mx-4 rounded-none border-x-0 sm:mx-0 sm:rounded-xl sm:border-x"
          : "rounded-xl",
        className,
      )}
    >
      {title ? (
        <header className="border-b border-border/60 px-3 py-2.5 sm:px-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            {title}
          </h3>
          {description ? (
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {description}
            </p>
          ) : null}
        </header>
      ) : null}
      <div
        className={cn(
          "space-y-3 p-3 sm:p-4",
          expanded && "px-3 sm:px-4",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
