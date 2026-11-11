"use client";

import { cn } from "@/utils/cn";

const WIDE = new Set([
  "cmdk",
  "kanban",
  "matrix",
  "chat",
  "wizard",
  "analytics",
  "calendar",
  "form",
  "notify",
  "scope",
]);

const TREE_CLASS = [
  "text-muted-foreground",
  "pl-3 font-medium text-foreground",
  "pl-3 text-muted-foreground",
  "pl-6 text-primary",
  "text-muted-foreground",
];

const KANBAN_PROGRESS = [
  [70, 35],
  [90],
];

/** @param {ReturnType<import("@/lib/midnightLandingCopy.js").getMidnightCopy>["marquee"]} copy */
function buildTiles(copy) {
  return [
    {
      id: "cmdk",
      label: copy.cmdk.label,
      node: (
        <div className="w-full overflow-hidden rounded-xl border border-border bg-background text-left shadow-soft">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <span className="text-[11px] text-muted-foreground">⌘K</span>
            <span className="min-w-0 truncate text-[12px] text-muted-foreground">{copy.cmdk.placeholder}</span>
          </div>
          <ul className="space-y-0.5 p-1.5 text-[11px]">
            {copy.cmdk.rows.map((r) => (
              <li
                key={r.t}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg px-2 py-1.5",
                  r.hot ? "bg-primary/15 text-foreground" : "text-muted-foreground",
                )}
              >
                <span className={cn("min-w-0", r.hot && "font-medium")}>{r.t}</span>
                <kbd className="shrink-0 rounded border border-border bg-muted px-1 font-mono text-[9px]">{r.k}</kbd>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      id: "kanban",
      label: copy.kanban.label,
      node: (
        <div className="grid w-full grid-cols-2 gap-2 text-left">
          {copy.kanban.columns.map((c, colIndex) => (
            <div key={c.col} className="rounded-xl border border-border bg-muted/40 p-1.5">
              <p className="px-1 pb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{c.col}</p>
              <div className="space-y-1.5">
                {c.cards.map((title, cardIndex) => (
                  <div key={title} className="rounded-lg border border-border bg-card px-2 py-1.5 shadow-soft">
                    <p className="text-[10px] font-medium leading-snug">{title}</p>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${KANBAN_PROGRESS[colIndex][cardIndex]}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "matrix",
      label: copy.matrix.label,
      node: (
        <div className="w-full overflow-hidden rounded-xl border border-border bg-card text-left">
          <div className="grid grid-cols-[1.4fr_repeat(3,0.6fr)] gap-px bg-border text-[9px]">
            <div className="bg-muted/80 px-2 py-1.5 font-medium text-muted-foreground">{copy.matrix.roleHeader}</div>
            {copy.matrix.perms.map((h) => (
              <div key={h} className="bg-muted/80 px-1 py-1.5 text-center font-medium text-muted-foreground">
                {h}
              </div>
            ))}
            {copy.matrix.rows.map((row) => (
              <div key={row.r} className="contents">
                <div className="bg-card px-2 py-1.5 text-[10px] font-medium leading-snug">{row.r}</div>
                {row.c.map((on, i) => (
                  <div key={i} className="flex items-center justify-center bg-card py-1.5">
                    <span
                      className={cn(
                        "size-3.5 rounded-sm border",
                        on ? "border-primary bg-primary" : "border-border bg-muted",
                      )}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "chat",
      label: copy.chat.label,
      node: (
        <div className="flex w-full flex-col gap-1.5 text-left">
          <div className="max-w-[85%] self-start rounded-2xl rounded-bl-md border border-border bg-muted px-2.5 py-1.5 text-[10px] leading-snug text-foreground">
            {copy.chat.incoming}
          </div>
          <div className="max-w-[88%] self-end rounded-2xl rounded-br-md bg-primary px-2.5 py-1.5 text-[10px] leading-snug text-primary-foreground">
            {copy.chat.outgoing}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1.5 text-[10px] text-muted-foreground">
            <span className="min-w-0 flex-1 truncate">{copy.chat.placeholder}</span>
            <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold text-primary-foreground">
              {copy.chat.send}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "wizard",
      label: copy.wizard.label,
      node: (
        <div className="w-full space-y-3 text-left">
          <div className="flex items-center gap-1">
            {copy.wizard.steps.map((s, i) => (
              <div key={s} className="flex min-w-0 flex-1 items-center gap-1">
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                    i < 2 ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground",
                  )}
                >
                  {i < 2 ? "✓" : "3"}
                </span>
                <span
                  className={cn(
                    "min-w-0 truncate text-[10px]",
                    i === 1 ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s}
                </span>
                {i < 2 ? <span className="mx-0.5 h-px flex-1 bg-primary/50" /> : null}
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2">
            <p className="text-[10px] font-medium text-primary">{copy.wizard.currentTitle}</p>
            <p className="mt-0.5 text-[11px] text-foreground/90">{copy.wizard.currentBody}</p>
          </div>
        </div>
      ),
    },
    {
      id: "analytics",
      label: copy.analytics.label,
      node: (
        <div className="w-full rounded-xl border border-border bg-card p-2.5 text-left shadow-soft">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{copy.analytics.caption}</p>
              <p className="text-lg font-semibold tabular-nums tracking-tight">128</p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:text-emerald-400">
              +12%
            </span>
          </div>
          <svg viewBox="0 0 120 36" className="mt-2 h-9 w-full text-primary" aria-hidden>
            <path
              d="M0 28 L20 22 L40 24 L60 14 L80 18 L100 8 L120 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M0 28 L20 22 L40 24 L60 14 L80 18 L100 8 L120 12 L120 36 L0 36 Z"
              fill="currentColor"
              opacity="0.12"
            />
          </svg>
        </div>
      ),
    },
    {
      id: "calendar",
      label: copy.calendar.label,
      node: (
        <div className="w-full overflow-hidden rounded-xl border border-border bg-card text-left">
          <div className="grid grid-cols-5 border-b border-border text-center text-[9px] text-muted-foreground">
            {copy.calendar.days.map((d, i) => (
              <div key={d} className={cn("py-1", i === 2 && "bg-primary/10 font-semibold text-primary")}>
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-px bg-border p-px">
            {copy.calendar.days.map((d, i) => (
              <div key={d} className="min-h-[3.25rem] bg-card p-1">
                {copy.calendar.events[i] ? (
                  <div
                    className={cn(
                      "rounded px-1 py-0.5 text-[8px] font-medium leading-tight",
                      i === 2
                        ? "bg-amber-500/20 text-amber-800 dark:text-amber-300"
                        : i === 4
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/20 text-primary",
                    )}
                  >
                    {copy.calendar.events[i]}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "form",
      label: copy.form.label,
      node: (
        <div className="w-full space-y-2 text-left">
          <label className="block">
            <span className="text-[9px] font-medium text-muted-foreground">{copy.form.emailLabel}</span>
            <div className="mt-0.5 truncate rounded-lg border border-destructive/60 bg-background px-2.5 py-1.5 text-[11px]">
              {copy.form.emailValue}
            </div>
            <p className="mt-0.5 text-[9px] leading-snug text-destructive">{copy.form.emailError}</p>
          </label>
          <label className="block">
            <span className="text-[9px] font-medium text-primary">{copy.form.codeLabel}</span>
            <div className="mt-0.5 truncate rounded-lg border border-primary/50 bg-primary/5 px-2.5 py-1.5 text-[11px] font-medium">
              {copy.form.codeValue}
            </div>
          </label>
        </div>
      ),
    },
    {
      id: "tree",
      label: copy.tree.label,
      node: (
        <ul className="w-full space-y-0.5 text-left font-mono text-[10px] leading-relaxed">
          {copy.tree.lines.map((line, i) => (
            <li key={line} className={TREE_CLASS[i]}>
              {line}
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: "funnel",
      label: copy.funnel.label,
      node: (
        <div className="flex w-full flex-col items-center gap-1" aria-hidden>
          {copy.funnel.steps.map((n, i) => (
            <div
              key={n}
              className="truncate rounded-sm bg-primary/80 py-1 text-center text-[8px] font-medium text-primary-foreground"
              style={{ width: ["100%", "78%", "52%", "31%"][i] }}
            >
              {n}
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "heat",
      label: copy.heat.label,
      node: (
        <div className="grid w-full grid-cols-7 gap-1" aria-hidden>
          {Array.from({ length: 28 }, (_, i) => {
            const v = [0.15, 0.35, 0.55, 0.8, 1, 0.4, 0.2][i % 7] * ((i % 5) + 1) * 0.2;
            return (
              <span
                key={i}
                className="aspect-square rounded-[3px] bg-primary"
                style={{ opacity: Math.min(0.95, 0.12 + v) }}
              />
            );
          })}
        </div>
      ),
    },
    {
      id: "invoice",
      label: copy.invoice.label,
      node: (
        <div className="w-full rounded-xl border border-dashed border-border bg-muted/30 px-2.5 py-2 text-left text-[10px]">
          <p className="font-semibold">{copy.invoice.title}</p>
          <div className="mt-1.5 space-y-0.5 text-muted-foreground">
            {copy.invoice.rows.map((row) => (
              <div key={row.name} className="flex justify-between gap-2">
                <span className="min-w-0 truncate">{row.name}</span>
                <span className="shrink-0 tabular-nums text-foreground">{row.qty}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between border-t border-border pt-1.5 font-medium">
            <span>{copy.invoice.totalLabel}</span>
            <span className="tabular-nums">{copy.invoice.totalValue}</span>
          </div>
        </div>
      ),
    },
    {
      id: "notify",
      label: copy.notify.label,
      node: (
        <div className="w-full overflow-hidden rounded-xl border border-border bg-card text-left shadow-soft">
          <div className="flex items-center justify-between border-b border-border px-2.5 py-1.5">
            <span className="text-[10px] font-semibold">{copy.notify.label}</span>
            <span className="rounded-full bg-destructive px-1.5 text-[9px] font-bold text-destructive-foreground">3</span>
          </div>
          <ul className="divide-y divide-border text-[10px]">
            {copy.notify.items.map((n) => (
              <li key={n.t} className="flex items-start justify-between gap-2 px-2.5 py-1.5">
                <span className="min-w-0 leading-snug">{n.t}</span>
                <span className="shrink-0 text-muted-foreground">{n.m}</span>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      id: "scope",
      label: copy.scope.label,
      node: (
        <div className="grid w-full grid-cols-2 gap-2 text-left">
          <div className="min-w-0 rounded-xl border border-border bg-muted/40 px-2.5 py-2">
            <p className="text-[9px] text-muted-foreground">{copy.scope.leftName}</p>
            <p className="text-sm font-semibold tabular-nums">{copy.scope.leftValue}</p>
            <p className="mt-1 text-[9px] leading-snug text-muted-foreground">{copy.scope.leftNote}</p>
          </div>
          <div className="min-w-0 rounded-xl border border-primary bg-primary/10 px-2.5 py-2 ring-1 ring-primary/30">
            <p className="text-[9px] font-medium text-primary">{copy.scope.rightName}</p>
            <p className="text-sm font-semibold tabular-nums">{copy.scope.rightValue}</p>
            <p className="mt-1 text-[9px] leading-snug text-foreground/80">{copy.scope.rightNote}</p>
          </div>
        </div>
      ),
    },
    {
      id: "signin",
      label: copy.signin.label,
      node: (
        <div className="flex w-full flex-col items-center gap-2 rounded-xl border border-border bg-gradient-to-b from-primary/15 to-transparent px-3 py-2">
          <span className="flex size-10 items-center justify-center rounded-full border border-primary/40 bg-card text-primary shadow-soft">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              <path d="M12 11v4m0 0 2 2m-2-2-2 2" />
              <path d="M5 19a7 7 0 0 1 14 0" />
            </svg>
          </span>
          <div className="text-center text-[10px] leading-tight">
            <p className="font-semibold">{copy.signin.title}</p>
            <p className="text-muted-foreground">{copy.signin.hint}</p>
          </div>
        </div>
      ),
    },
  ];
}

function TileCard({ tile, hidden }) {
  return (
    <div
      className={cn(
        "ql-marquee-tile flex shrink-0 flex-col gap-2.5 rounded-2xl border border-border bg-card/95 p-4 shadow-soft backdrop-blur-sm",
        WIDE.has(tile.id) ? "w-[17.5rem] sm:w-[19.5rem]" : "w-[14rem] sm:w-[15.5rem]",
      )}
      aria-hidden={hidden || undefined}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{tile.label}</p>
      <div className="flex min-h-[7.5rem] flex-1 items-center justify-center sm:min-h-[8.25rem]">{tile.node}</div>
    </div>
  );
}

function MarqueeRow({ tiles, reverse = false }) {
  const loop = [...tiles, ...tiles];
  return (
    <div className="ql-marquee-viewport overflow-hidden">
      <div className={cn("ql-marquee-track flex w-max gap-4 pr-4", reverse && "ql-marquee-track-reverse")}>
        {loop.map((tile, i) => (
          <TileCard key={`${tile.id}-${i}`} tile={tile} hidden={i >= tiles.length} />
        ))}
      </div>
    </div>
  );
}

/**
 * Dual-row component banner. CSS translate loop; static wrap when prefers-reduced-motion.
 * @param {{ copy: ReturnType<import("@/lib/midnightLandingCopy.js").getMidnightCopy>["marquee"], className?: string }} props
 */
export function ComponentMarquee({ copy, className }) {
  const tiles = buildTiles(copy);
  const rowA = tiles.slice(0, 8);
  const rowB = tiles.slice(7);

  return (
    <section className={cn("ql-marquee relative py-12 sm:py-16", className)} aria-label={copy.aria}>
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent sm:w-20"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent sm:w-20"
        aria-hidden
      />

      <div className="ql-marquee-live space-y-4">
        <MarqueeRow tiles={rowA} />
        <MarqueeRow tiles={rowB} reverse />
      </div>

      <div className="ql-marquee-static mx-auto hidden max-w-[90rem] flex-wrap justify-center gap-4 px-4">
        {tiles.map((tile) => (
          <TileCard key={tile.id} tile={tile} />
        ))}
      </div>
    </section>
  );
}
