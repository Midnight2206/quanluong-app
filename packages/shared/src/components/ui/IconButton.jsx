import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { Tooltip } from "@/components/ui/Tooltip";

const variantStyles = {
  /** Nổi trên nền muted/card — mặc định cho thao tác trong bảng */
  surface:
    "border-2 border-border/90 bg-card text-foreground shadow-sm hover:bg-muted/90 hover:border-primary/35",
  primary:
    "border border-primary/25 bg-primary text-primary-foreground shadow-md shadow-primary/15 hover:brightness-[1.06] active:brightness-95",
  ghost:
    "border border-border/60 bg-background/85 text-foreground shadow-sm hover:bg-muted/90 hover:border-primary/28",
  danger:
    "border-2 border-destructive/40 bg-destructive/12 text-destructive shadow-sm hover:bg-destructive/22 hover:border-destructive/55",
};

/**
 * Nút chỉ icon: `label` → tooltip hiển thị khi hover (xem `Tooltip`) + `aria-label`.
 * `loading` thay nội dung bằng spinner (giữ kích thước ô vuông).
 */
export function IconButton({
  label,
  variant = "surface",
  loading = false,
  className,
  disabled,
  children,
  type = "button",
  tooltipSide = "bottom",
  ...rest
}) {
  const v = variantStyles[variant] ?? variantStyles.surface;
  const btn = (
    <button
      type={type}
      aria-label={label}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-55",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]",
        v,
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-current" aria-hidden />
      ) : (
        children
      )}
    </button>
  );

  return (
    <Tooltip content={label} side={tooltipSide}>
      {btn}
    </Tooltip>
  );
}
