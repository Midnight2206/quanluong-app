import { QUANLUONG_BRAND_LOGO_SRC, QUANLUONG_SITE_NAME } from "@/lib/quanLuongPageMeta";
import { cn } from "@/utils/cn";

export function AppBrand({ compact = false }) {
  return (
    <div className={cn("flex items-center", compact ? "gap-2 lg:gap-3" : "gap-3")}>
      <img
        src={QUANLUONG_BRAND_LOGO_SRC}
        alt={QUANLUONG_SITE_NAME}
        width={44}
        height={44}
        decoding="async"
        className={cn(
          "shrink-0 object-contain",
          compact ? "h-9 w-9 lg:h-11 lg:w-11" : "h-11 w-11",
        )}
      />
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.18em] text-foreground",
          compact && "hidden sm:block",
        )}
      >
        {QUANLUONG_SITE_NAME}
      </p>
    </div>
  );
}
