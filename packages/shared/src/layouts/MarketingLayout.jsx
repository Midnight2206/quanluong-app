"use client";

import Link from "next/link";
import { AppBrand } from "@/components/common/AppBrand";
import { ThemePicker } from "@/components/common/ThemeToggle";
import { UnifiedPageScrollRoot } from "@/hocs/withUnifiedPageScroll";
import { MIDNIGHT_LOCALES } from "@/lib/midnightLocale";
import { LocaleText, MidnightLocaleProvider, useMidnightLocale } from "@/lib/midnightLocale.jsx";
import { cn } from "@/utils/cn";

const btnBase =
  "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background max-lg:min-h-11 max-lg:px-2.5";

function LanguageSwitcher() {
  const { locale, setLocale, copy } = useMidnightLocale();
  const options = [
    { id: "vi", short: "VI", label: copy.nav.langVi },
    { id: "en", short: "EN", label: copy.nav.langEn },
  ];
  return (
    <div
      role="group"
      aria-label={copy.nav.langAria}
      className="inline-flex items-center rounded-lg border border-border bg-card p-0.5 shadow-sm"
    >
      {options.map((option) => {
        const active = locale === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            aria-label={option.label}
            className={cn(
              "inline-flex h-10 min-w-10 items-center justify-center rounded-md px-2 text-xs font-semibold tracking-wide transition max-lg:h-11 max-lg:min-w-11",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
            )}
            data-control={`lang-${option.id}`}
            onClick={() => setLocale(option.id)}
          >
            <span className="inline-grid" style={{ gridTemplateColumns: "minmax(0, max-content)" }}>
              {MIDNIGHT_LOCALES.map((loc) => (
                <span
                  key={loc}
                  className={cn("col-start-1 row-start-1", loc !== option.id && "invisible")}
                  aria-hidden={loc === option.id ? undefined : true}
                >
                  {loc.toUpperCase()}
                </span>
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MarketingShell({ children }) {
  const { copy } = useMidnightLocale();
  return (
    <div className="ql-landing page-shell flex min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="relative z-40 flex min-h-[4.25rem] shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur-md sm:h-[4.5rem] sm:flex-nowrap sm:gap-3 sm:px-6 sm:py-0 lg:px-8">
        <div className="flex min-w-12 flex-1 items-center">
          <Link href="/" className="shrink-0" aria-label={copy.nav.homeAria}>
            <AppBrand compact logoOnly />
          </Link>
        </div>
        <nav
          className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 max-sm:basis-full sm:gap-2"
          aria-label={copy.nav.navAria}
        >
          <LanguageSwitcher />
          <ThemePicker variant="popover" labels={copy.theme} controlId="theme" />
          <Link
            href="/login"
            data-control="header-login"
            className={cn(
              btnBase,
              "max-w-full border border-input bg-card text-foreground shadow-soft hover:border-primary/40 hover:bg-muted",
            )}
          >
            <LocaleText pick={(item) => item.nav.login} />
          </Link>
          <Link
            href="/register"
            data-control="header-register"
            className={cn(
              btnBase,
              "max-w-full border border-primary bg-primary font-semibold text-primary-foreground shadow-soft hover:bg-primary/90",
            )}
          >
            <LocaleText pick={(item) => item.nav.register} />
          </Link>
        </nav>
      </header>
      <div
        data-page-scroll-owner="true"
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch]"
      >
        <UnifiedPageScrollRoot className="min-h-full">{children}</UnifiedPageScrollRoot>
      </div>
    </div>
  );
}

/**
 * Shell cho landing Midnight — theme sáng/tối + accent, không sidebar / chat dock.
 * `initialLocale` comes from the `midnight_lang` cookie so the first paint matches the server.
 */
export function MarketingLayout({ initialLocale = "vi", children }) {
  return (
    <MidnightLocaleProvider initialLocale={initialLocale}>
      <MarketingShell>{children}</MarketingShell>
    </MidnightLocaleProvider>
  );
}
