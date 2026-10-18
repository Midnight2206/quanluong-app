import { cn } from "@/utils/cn";
import { Tooltip } from "@/components/ui/Tooltip";

const variants = {
  primary:
    "border border-primary bg-primary text-primary-foreground shadow-soft hover:bg-primary/90 active:bg-primary/85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  secondary:
    "border border-input bg-card text-foreground shadow-soft hover:bg-muted hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  ghost:
    "border border-border bg-transparent text-foreground hover:bg-secondary hover:text-secondary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  destructive:
    "border border-destructive bg-destructive text-destructive-foreground shadow-soft hover:bg-destructive/90 active:bg-destructive/85 focus-visible:ring-2 focus-visible:ring-destructive/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  /** Nút hủy / từ chối — nền nhạt, chữ đỏ, vẫn rõ trên nền card */
  dangerGhost:
    "border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:border-destructive/60 focus-visible:ring-2 focus-visible:ring-destructive/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-55",
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
