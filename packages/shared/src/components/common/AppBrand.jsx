import { cn } from "@/utils/cn";

// Brand orange is fixed on purpose (does not follow the accent palette).
export function AppBrand({ compact = false }) {
  return (
    <div className={cn("flex items-center", compact ? "gap-2 lg:gap-3" : "gap-3")}>
      <div
        className={cn(
          "flex items-center justify-center rounded-lg bg-[#f26f21] font-bold text-white",
          compact ? "h-9 w-9 text-xs lg:h-11 lg:w-11 lg:text-sm" : "h-11 w-11 text-sm",
        )}
      >
        QL
      </div>
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.18em] text-foreground",
          compact && "hidden sm:block",
        )}
      >
        Quân lương
      </p>
    </div>
  );
}
