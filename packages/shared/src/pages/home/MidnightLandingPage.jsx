"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ClientRedirect } from "@/hocs/ClientRedirect";
import { useAuthInitialized, useIsAuthenticated } from "@/features/auth/model/authSlice";
import { MIDNIGHT_CONTACT } from "@/lib/midnightContact";
import { QUANLUONG_BRAND_LOGO_MARK_SRC } from "@/lib/quanLuongPageMeta";
import { useMidnightLocale } from "@/lib/midnightLocale.jsx";
import { cn } from "@/utils/cn";
import { ComponentMarquee } from "./landing/ComponentMarquee";
import { Reveal } from "./landing/Reveal";

const btnBase =
  "inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const sectionWrap = "mx-auto w-full max-w-[90rem]";

function MidnightSeal({ className }) {
  return (
    <div className={cn("relative mx-auto size-28 sm:size-36", className)} title="Midnight">
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <path id="ql-landing-ring" d="M 50,50 m -33,0 a 33,33 0 1,1 66,0 a 33,33 0 1,1 -66,0" fill="none" />
          <linearGradient id="ql-landing-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--ql-brand-from)" />
            <stop offset="55%" stopColor="var(--ql-brand-via)" />
            <stop offset="100%" stopColor="var(--ql-brand-to)" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="46" fill="none" stroke="url(#ql-landing-grad)" strokeWidth="1.25" opacity="0.75" />
        <text
          fill="url(#ql-landing-grad)"
          fontSize="8.5"
          fontWeight="600"
          letterSpacing="0.2em"
          dominantBaseline="middle"
          style={{ textTransform: "uppercase" }}
        >
          <textPath href="#ql-landing-ring" xlinkHref="#ql-landing-ring" startOffset="0%">
            Midnight · Midnight · Midnight ·
          </textPath>
        </text>
      </svg>
      <img
        src={QUANLUONG_BRAND_LOGO_MARK_SRC}
        alt=""
        width={80}
        height={80}
        decoding="async"
        className="ql-brand-mark absolute left-1/2 top-1/2 size-[48%] -translate-x-1/2 -translate-y-1/2 rounded-full object-contain"
      />
    </div>
  );
}

export function MidnightLandingPage() {
  const isAuthenticated = useIsAuthenticated();
  const initialized = useAuthInitialized();
  const searchParams = useSearchParams();
  const { copy } = useMidnightLocale();

  if (!initialized) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">{copy.loading}</div>
    );
  }

  if (isAuthenticated) {
    const driveCallback = searchParams.has("google");
    const qs = searchParams.toString();
    return <ClientRedirect href={driveCallback ? `/profile?${qs}` : "/dashboard"} replace />;
  }

  return (
    <div className="ql-landing relative bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="ql-landing-aurora absolute -left-1/4 top-0 h-[70vh] w-[70vw] rounded-full bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.18),transparent_70%)]" />
        <div className="ql-landing-aurora ql-landing-aurora-2 absolute -right-1/4 top-1/3 h-[60vh] w-[60vw] rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--ql-brand-via)_22%,transparent),transparent_70%)]" />
      </div>

      <section className="relative flex min-h-[calc(100dvh-4.5rem)] flex-col items-center justify-center px-4 pb-10 pt-10 text-center sm:px-8 sm:pb-14">
        <div className="ql-hero-stage flex w-full max-w-3xl flex-col items-center gap-6">
          <div className="ql-hero-item" style={{ "--ql-hero-i": 0 }}>
            <MidnightSeal />
          </div>
          <h1
            className="ql-hero-item font-[family-name:var(--font-display)] text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl"
            style={{ "--ql-hero-i": 1 }}
          >
            <span className="ql-brand-text">Midnight</span>
          </h1>
          <p
            className="ql-hero-item max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg"
            style={{ "--ql-hero-i": 2 }}
          >
            {copy.hero.lead}
          </p>
          <p
            className="ql-hero-item max-w-2xl text-balance text-sm leading-relaxed text-muted-foreground/90 sm:text-[0.95rem]"
            style={{ "--ql-hero-i": 3 }}
          >
            {copy.hero.support}
          </p>
          <div className="ql-hero-item flex flex-wrap items-center justify-center gap-3" style={{ "--ql-hero-i": 4 }}>
            <Link
              href="/login"
              className={cn(btnBase, "border border-primary bg-primary font-semibold text-primary-foreground shadow-soft hover:bg-primary/90")}
            >
              {copy.hero.login}
            </Link>
            <a
              href="#mau-giao-dien"
              className={cn(
                btnBase,
                "border border-input bg-card text-foreground shadow-soft hover:border-primary/40 hover:bg-muted",
              )}
            >
              {copy.hero.samples}
            </a>
          </div>
        </div>
      </section>

      <div id="mau-giao-dien" className="relative scroll-mt-20 border-y border-border bg-muted/25">
        <div className={cn(sectionWrap, "px-4 pb-2 pt-12 text-center sm:px-6 sm:pt-14 lg:px-10")}>
          <Reveal>
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {copy.strip.title}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {copy.strip.intro}
            </p>
          </Reveal>
        </div>
        <ComponentMarquee copy={copy.marquee} />
      </div>

      <section id="cong-nghe" className="relative scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-10 xl:px-14">
        <div className={sectionWrap}>
          <Reveal>
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {copy.tech.title}
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">{copy.tech.intro}</p>
          </Reveal>
          <div className="mt-14 space-y-12">
            {copy.tech.blocks.map((block, i) => (
              <Reveal key={block.key} delayMs={i * 70}>
                <article className="border-t border-border pt-8 lg:grid lg:grid-cols-12 lg:gap-8">
                  <div className="lg:col-span-4">
                    <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground sm:text-2xl">
                      {block.title}
                    </h3>
                    <ul className="mt-4 flex flex-wrap gap-2" aria-label={`${copy.tech.listAria} ${block.title}`}>
                      {block.tags.map((tag) => (
                        <li
                          key={tag}
                          className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium tracking-wide text-foreground/90 shadow-soft"
                        >
                          {tag}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground lg:col-span-8 lg:mt-0 lg:text-[0.95rem] lg:leading-7">
                    {block.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
          <div className="mt-12 border-t border-border pt-8">
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{copy.tech.studioLead}</p>
            <ul className="mt-4 flex flex-wrap gap-2" aria-label={copy.tech.studioAria}>
              {copy.tech.studioTags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-md border border-dashed border-border bg-card px-2.5 py-1 text-[11px] font-medium tracking-wide text-foreground/90 shadow-soft"
                >
                  {tag}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="relative px-4 py-16 sm:px-6 sm:py-20 lg:px-10 xl:px-14">
        <div className={sectionWrap}>
          <Reveal>
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {copy.services.title}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">{copy.services.intro}</p>
          </Reveal>
          <div className="mt-12 grid gap-10 lg:grid-cols-12 lg:gap-6">
            {copy.services.items.map((s, i) => (
              <Reveal
                key={s.key}
                delayMs={i * 90}
                className={cn(i === 0 ? "lg:col-span-5" : i === 1 ? "lg:col-span-4" : "lg:col-span-3")}
              >
                <article className="h-full border-t border-border pt-5">
                  <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground sm:text-2xl">
                    {s.title}
                  </p>
                  <p className="mt-3 text-sm font-medium text-foreground/90">{s.lead}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.detail}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <footer id="lien-he" className="relative border-t border-border bg-card/70 px-4 py-14 sm:px-6 sm:py-16 lg:px-10 xl:px-14">
        <div className={cn(sectionWrap, "grid gap-10 md:grid-cols-12 md:gap-8 lg:gap-12")}>
          <div className="md:col-span-5">
            <p className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
              <span className="ql-brand-text">Midnight</span>
            </p>
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
              {copy.about.title}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{copy.about.body}</p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <Link href="/login" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                {copy.nav.login}
              </Link>
              <Link href="/register" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                {copy.nav.register}
              </Link>
            </div>
          </div>

          <div className="md:col-span-7">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">{copy.contact.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{copy.contact.hint}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {Object.entries(MIDNIGHT_CONTACT).map(([key, item]) => {
                const Icon = item.Icon;
                const external = item.href?.startsWith("http");
                const label = copy.contact.labels[key];
                return (
                  <li key={key}>
                    <a
                      href={item.href}
                      target={external ? "_blank" : undefined}
                      rel={external ? "noopener noreferrer" : undefined}
                      className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-3.5 py-3 transition hover:border-primary/40 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-foreground shadow-soft">
                        <Icon className="size-10" />
                      </span>
                      <span className="min-w-0 text-left">
                        <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          {label}
                        </span>
                        <span className="mt-0.5 block truncate text-sm font-medium text-foreground">{item.value}</span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
