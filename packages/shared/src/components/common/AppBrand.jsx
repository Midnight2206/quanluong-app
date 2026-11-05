import { QUANLUONG_BRAND_LOGO_SRC, QUANLUONG_SITE_NAME } from "@/lib/quanLuongPageMeta";
import { cn } from "@/utils/cn";

export function AppBrand({ compact = false }) {
  return (
    <div className={cn("flex items-center", compact ? "gap-2 lg:gap-3" : "gap-3")}>
      <img
        src={QUANLUONG_BRAND_LOGO_SRC}
        alt={QUANLUONG_SITE_NAME}
        width={48}
        height={48}
        decoding="async"
        className={cn(
          "shrink-0 object-contain",
          compact ? "h-10 w-10 lg:h-12 lg:w-12" : "h-12 w-12",
        )}
      />
      <p
        className={cn(
          "bg-gradient-to-r from-[#1a007c] via-[#5d00be] to-[#b400fe] bg-clip-text text-xs font-semibold uppercase tracking-[0.18em] text-transparent print:bg-none print:text-foreground",
          compact && "hidden sm:block",
        )}
      >
        {QUANLUONG_SITE_NAME}
      </p>
    </div>
  );
}
