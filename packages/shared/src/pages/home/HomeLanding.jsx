"use client";

import { BookOpen, Bot, FileText, Warehouse } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/utils/cn";
import { formatLandingGreeting, LANDING_LOCALES } from "./landingCopy.js";

const FEATURE_ICONS = [Warehouse, BookOpen, FileText, Bot];

function CtaLink({ href, variant = "primary", title, className, children }) {
  const variants = {
    primary:
      "border-primary bg-primary text-primary-foreground shadow-soft hover:bg-primary/90 active:bg-primary/85",
    secondary: "border-input bg-card text-foreground shadow-soft hover:bg-muted hover:border-primary/40",
  };
  return (
    <Link
      href={href}
      title={title}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background max-lg:min-h-11",
        variants[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}

function LandingLanguageSwitcher({ copy, locale, onLocaleChange }) {
  return (
    <div
      role="group"
      aria-label={copy.languageLabel}
      className="flex w-full overflow-hidden rounded-lg border border-border sm:w-auto"
    >
      {LANDING_LOCALES.map((code) => {
        const selected = locale === code;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={selected}
            onClick={() => onLocaleChange(code)}
            className={cn(
              "inline-flex min-h-11 flex-1 items-center justify-center px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex-none sm:px-4",
              selected ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted",
            )}
          >
            {copy.languageNames[code]}
          </button>
        );
      })}
    </div>
  );
}

function SectionHeading({ id, title, lead }) {
  return (
    <div className="min-w-0">
      <h2 id={id} className="text-base font-semibold text-foreground">
        {title}
      </h2>
      {lead ? <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">{lead}</p> : null}
    </div>
  );
}

/**
 * @param {{
 *   copy: import("./landingCopy.js").landingCopy["vi"],
 *   locale: string,
 *   onLocaleChange: (code: string) => void,
 *   isAuthenticated: boolean,
 *   displayName?: string | null,
 *   driveSlot?: import("react").ReactNode,
 * }} props
 */
export function HomeLanding({ copy, locale, onLocaleChange, isAuthenticated, displayName, driveSlot }) {
  const greeting = formatLandingGreeting(copy, displayName);

  return (
    <div lang={copy.htmlLang} className="flex w-full min-w-0 flex-col gap-4 pb-2">
      <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-sm text-muted-foreground">{copy.heroKicker}</p>
        <LandingLanguageSwitcher copy={copy} locale={locale} onLocaleChange={onLocaleChange} />
      </div>

      <section className="grid w-full min-w-0 gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(16rem,1fr)] lg:items-stretch">
        <div className="flex min-w-0 gap-3">
          <span
            aria-hidden
            className="w-1 shrink-0 self-stretch rounded-full"
            style={{
              backgroundImage:
                "linear-gradient(to bottom, var(--ql-brand-from), var(--ql-brand-via), var(--ql-brand-to))",
            }}
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground xl:text-3xl">{copy.heroTitle}</h1>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">{copy.heroBody}</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-3 rounded-lg border bg-card p-3">
          {isAuthenticated ? (
            <>
              <p className="text-sm font-medium text-foreground">{greeting}</p>
              <CtaLink href="/dashboard" title={copy.ctaDashboardTitle} className="w-full">
                {copy.ctaDashboard}
              </CtaLink>
            </>
          ) : (
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
              <CtaLink href="/login" title={copy.ctaLoginTitle} className="w-full flex-1">
                {copy.ctaLogin}
              </CtaLink>
              <CtaLink href="/register" variant="secondary" title={copy.ctaRegisterTitle} className="w-full flex-1">
                {copy.ctaRegister}
              </CtaLink>
            </div>
          )}
        </div>
      </section>

      {driveSlot}

      <section className="w-full min-w-0 space-y-3" aria-labelledby="landing-features">
        <SectionHeading id="landing-features" title={copy.featuresTitle} lead={copy.featuresLead} />
        <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {copy.features.map((feature, index) => {
            const Icon = FEATURE_ICONS[index] ?? Warehouse;
            return (
              <Card key={feature.title} className="h-full min-w-0">
                <CardContent className="flex h-full min-w-0 gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <Icon className="size-[18px]" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold leading-snug text-foreground">{feature.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                      {feature.body}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="w-full min-w-0 space-y-3" aria-labelledby="landing-workflow">
        <SectionHeading id="landing-workflow" title={copy.workflowTitle} lead={copy.workflowLead} />
        <ol className="grid w-full gap-3 md:grid-cols-2 xl:grid-cols-4">
          {copy.steps.map((step, index) => (
            <li key={step.title} className="min-w-0 rounded-lg border bg-card p-3">
              <p className="text-sm font-semibold text-primary">{index + 1}</p>
              <h3 className="mt-1 text-sm font-semibold text-foreground">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="w-full min-w-0 space-y-3" aria-labelledby="landing-security">
        <SectionHeading id="landing-security" title={copy.securityTitle} lead={copy.securityLead} />
        <dl className="grid w-full gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 xl:grid-cols-3">
          {copy.security.map((item) => (
            <div key={item.title} className="min-w-0 bg-card p-3">
              <dt className="text-sm font-semibold text-foreground">{item.title}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{item.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        className="flex w-full min-w-0 flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
        aria-labelledby="landing-cta"
      >
        <div className="min-w-0">
          <h2 id="landing-cta" className="text-base font-semibold text-foreground">
            {copy.ctaTitle}
          </h2>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">{copy.ctaBody}</p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          {isAuthenticated ? (
            <CtaLink href="/dashboard" title={copy.ctaDashboardTitle} className="w-full sm:w-auto">
              {copy.ctaDashboard}
            </CtaLink>
          ) : (
            <>
              <CtaLink href="/login" title={copy.ctaLoginTitle} className="w-full sm:w-auto">
                {copy.ctaLogin}
              </CtaLink>
              <CtaLink href="/register" variant="secondary" title={copy.ctaRegisterTitle} className="w-full sm:w-auto">
                {copy.ctaRegister}
              </CtaLink>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
