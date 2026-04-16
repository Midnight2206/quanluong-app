import { cn } from "@/utils/cn";
import { Tooltip } from "@/components/ui/Tooltip";

const variants = {
  primary:
    "border border-primary/20 bg-primary text-primary-foreground shadow-md shadow-primary/15 hover:brightness-[1.06] active:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  secondary:
    "border-2 border-border/90 bg-card text-foreground shadow-sm hover:bg-muted/90 hover:border-primary/35 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  ghost:
    "border border-border/60 bg-background/80 text-foreground shadow-sm hover:bg-muted/85 hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  destructive:
    "border border-destructive/25 bg-destructive text-destructive-foreground shadow-sm hover:opacity-95 active:opacity-90 focus-visible:ring-2 focus-visible:ring-destructive/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  /** Nút hủy / từ chối — nền nhạt, chữ đỏ, vẫn rõ trên nền card */
  dangerGhost:
    "border-2 border-destructive/35 bg-destructive/10 text-destructive shadow-sm hover:bg-destructive/18 hover:border-destructive/50 focus-visible:ring-2 focus-visible:ring-destructive/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
};

export function Button({
  className,
  type = "button",
  variant = "primary",
  title,
  tooltipSide = "bottom",
  ...props
}) {
  const btn = (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-55",
        variants[variant] ?? variants.primary,
        className,
      )}
      {...props}
    />
  );

  if (title) {
    const tipWrapFull =
      typeof className === "string" && (/\bw-full\b/.test(className) || /\bflex-1\b/.test(className));
    return (
      <Tooltip
        content={title}
        side={tooltipSide}
        className={tipWrapFull ? "flex w-full min-w-0" : undefined}
      >
        {btn}
      </Tooltip>
    );
  }

  return btn;
}
