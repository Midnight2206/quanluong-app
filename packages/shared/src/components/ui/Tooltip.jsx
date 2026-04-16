import { useId, useState } from "react";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { cn } from "@/utils/cn";

/**
 * Tooltip dùng Floating UI: tự lật / đẩy vào trong khung màn hình (flip + shift).
 * - `default`: ngắn (~2 dòng).
 * - `detail`: rộng, chữ lớn — mô tả dài (vd. Thông tư).
 */
export function Tooltip({
  content,
  children,
  className,
  /** @type {'top' | 'bottom' | 'left' | 'right'} */
  side = "bottom",
  /** @type {'default' | 'detail'} */
  variant = "default",
}) {
  const [open, setOpen] = useState(false);
  const baseId = useId();
  const tooltipId = `${baseId}-tooltip`;

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: side,
    middleware: [
      offset(8),
      flip({ padding: 8, fallbackAxisSideDirection: "start" }),
      shift({ padding: 10, crossAxis: true }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, { move: false, delay: { open: 0, close: 80 } });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);

  if (content == null || content === "") {
    return children;
  }

  return (
    <>
      <span
        ref={refs.setReference}
        className={cn("inline-flex max-w-full align-middle", className)}
        {...getReferenceProps({ "aria-describedby": open ? tooltipId : undefined })}
      >
        {children}
      </span>
      {open ? (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            id={tooltipId}
            role="tooltip"
            style={floatingStyles}
            className={cn(
              "z-[400] shadow-float ring-1 [overflow-wrap:anywhere]",
              variant === "detail"
                ? cn(
                    "max-w-[min(32rem,calc(100vw-1.5rem))] rounded-xl border border-border bg-card px-4 py-3 text-left text-sm leading-relaxed text-card-foreground ring-black/5 dark:ring-white/10",
                    "whitespace-pre-wrap",
                  )
                : cn(
                    "max-w-[min(14rem,calc(100vw-1.25rem))] rounded-md bg-foreground px-2 py-1 text-center text-[10px] font-medium leading-tight text-background ring-black/10 dark:ring-white/15",
                    "line-clamp-2",
                  ),
            )}
            {...getFloatingProps()}
          >
            {content}
          </div>
        </FloatingPortal>
      ) : null}
    </>
  );
}
