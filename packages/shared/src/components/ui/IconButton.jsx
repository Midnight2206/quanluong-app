import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { Tooltip } from "@/components/ui/Tooltip";

const variantStyles = {
  /** Nổi trên nền muted/card — mặc định cho thao tác trong bảng */
  surface:
    "border border-input bg-card text-foreground shadow-soft hover:bg-muted hover:border-primary/40",
  primary:
    "border border-primary bg-primary text-primary-foreground shadow-soft hover:bg-primary/90 active:bg-primary/85",
  ghost:
    "border border-border bg-transparent text-foreground hover:bg-secondary hover:text-secondary-foreground",
  danger:
    "border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:border-destructive/60",
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
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-55",
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
