"use client";

import { useId } from "react";
import {
  QUANLUONG_BRAND_LOGO_MARK_SRC,
  QUANLUONG_SITE_NAME,
  QUANLUONG_SITE_SLOGAN,
} from "@/lib/quanLuongPageMeta";
import { cn } from "@/utils/cn";

/** Vòng chữ Midnight quanh logo (SVG textPath). Màu theo --ql-brand-*. */
function MidnightLogoRing({ className }) {
  const uid = useId().replace(/:/g, "");
  const pathId = `ql-midnight-ring-${uid}`;
  const gradId = `ql-midnight-ring-fill-${uid}`;
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
      aria-hidden
    >
      <defs>
        <path
          id={pathId}
          // Bán kính nhỏ hơn vòng ngoài (~r=46) để chữ cách viền một khoảng rõ.
          d="M 50,50 m -33,0 a 33,33 0 1,1 66,0 a 33,33 0 1,1 -66,0"
          fill="none"
        />
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--ql-brand-from)" />
          <stop offset="55%" stopColor="var(--ql-brand-via)" />
          <stop offset="100%" stopColor="var(--ql-brand-to)" />
        </linearGradient>
      </defs>
      <circle
        cx="50"
        cy="50"
        r="46"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="1.25"
        opacity="0.7"
      />
      <text
        fill={`url(#${gradId})`}
        fontSize="8.5"
        fontWeight="600"
        letterSpacing="0.2em"
        dominantBaseline="middle"
        style={{ textTransform: "uppercase" }}
      >
        <textPath href={`#${pathId}`} xlinkHref={`#${pathId}`} startOffset="0%">
          Midnight · Midnight · Midnight ·
        </textPath>
      </text>
    </svg>
  );
}

export function AppBrand({ compact = false, logoOnly = false }) {
  return (
    <div className={cn("flex min-w-0 items-center", compact ? "gap-2.5 lg:gap-3" : "gap-3")}>
      <div
        className={cn(
          "relative shrink-0",
          compact ? "size-12 lg:size-14" : "size-16",
        )}
        title="Midnight"
      >
        <MidnightLogoRing />
        <img
          src={QUANLUONG_BRAND_LOGO_MARK_SRC}
          alt={QUANLUONG_SITE_NAME}
          width={56}
          height={56}
          decoding="async"
          className="ql-brand-mark absolute left-1/2 top-1/2 size-[48%] -translate-x-1/2 -translate-y-1/2 rounded-full object-contain"
        />
      </div>
      {logoOnly ? null : (
        <div className={cn("min-w-0", compact && "hidden sm:block")}>
          <p className="ql-brand-text text-xs font-semibold uppercase tracking-[0.18em] print:bg-none print:text-foreground">
            {QUANLUONG_SITE_NAME}
          </p>
          <p
            className={cn(
              "ql-brand-text mt-0.5 text-[10px] leading-snug print:bg-none print:text-foreground",
              compact ? "max-w-[14rem] lg:max-w-[18rem]" : "max-w-[16rem]",
            )}
          >
            {QUANLUONG_SITE_SLOGAN}
          </p>
        </div>
      )}
    </div>
  );
}
