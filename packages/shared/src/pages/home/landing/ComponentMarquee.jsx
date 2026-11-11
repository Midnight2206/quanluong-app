"use client";

import { cn } from "@/utils/cn";

/** Mini UI tiles — denser craft mocks; theme tokens only. */
const TILES = [
  {
    id: "cmdk",
    label: "Command palette",
    wide: true,
    node: (
      <div className="w-full overflow-hidden rounded-xl border border-border bg-background text-left shadow-soft">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="text-[11px] text-muted-foreground">⌘K</span>
          <span className="text-[12px] text-muted-foreground">Tìm lệnh hoặc trang…</span>
        </div>
        <ul className="space-y-0.5 p-1.5 text-[11px]">
          {[
            { k: "↵", t: "Mở sổ nhập xuất LTTP", hot: true },
            { k: "G", t: "Đến chứng từ xuất" },
            { k: "P", t: "Hồ sơ · Google Drive" },
          ].map((r) => (
            <li
              key={r.t}
              className={cn(
                "flex items-center justify-between rounded-lg px-2 py-1.5",
                r.hot ? "bg-primary/15 text-foreground" : "text-muted-foreground",
              )}
            >
              <span className={cn(r.hot && "font-medium")}>{r.t}</span>
              <kbd className="rounded border border-border bg-muted px-1 font-mono text-[9px]">{r.k}</kbd>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: "kanban",
    label: "Kanban board",
    wide: true,
    node: (
      <div className="grid w-full grid-cols-2 gap-2 text-left">
        {[
          {
            col: "Doing",
            cards: [
              { t: "Phiếu xuất · A", p: 70 },
              { t: "Đối chiếu giá", p: 35 },
            ],
          },
          {
            col: "Review",
            cards: [{ t: "Chữ ký số", p: 90 }],
          },
        ].map((c) => (
          <div key={c.col} className="rounded-xl border border-border bg-muted/40 p-1.5">
            <p className="px-1 pb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              {c.col}
            </p>
            <div className="space-y-1.5">
              {c.cards.map((card) => (
                <div key={card.t} className="rounded-lg border border-border bg-card px-2 py-1.5 shadow-soft">
                  <p className="text-[10px] font-medium leading-snug">{card.t}</p>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${card.p}%` }} />
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
    label: "Permission matrix",
    wide: true,
    node: (
      <div className="w-full overflow-hidden rounded-xl border border-border bg-card text-left">
        <div className="grid grid-cols-[1.2fr_repeat(3,0.7fr)] gap-px bg-border text-[9px]">
          <div className="bg-muted/80 px-2 py-1.5 font-medium text-muted-foreground">Role</div>
          {["Xem", "Sửa", "Duyệt"].map((h) => (
            <div key={h} className="bg-muted/80 px-1 py-1.5 text-center font-medium text-muted-foreground">
              {h}
            </div>
          ))}
          {[
            { r: "Thủ kho", c: [1, 1, 0] },
            { r: "Chỉ huy", c: [1, 0, 1] },
            { r: "NCC", c: [1, 0, 0] },
          ].map((row) => (
            <div key={row.r} className="contents">
              <div className="bg-card px-2 py-1.5 text-[10px] font-medium">{row.r}</div>
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
    label: "Support chat",
    wide: true,
    node: (
      <div className="flex w-full flex-col gap-1.5 text-left">
        <div className="max-w-[85%] self-start rounded-2xl rounded-bl-md border border-border bg-muted px-2.5 py-1.5 text-[10px] leading-snug text-foreground">
          Đơn hàng LTTP tuần này đã khóa chưa?
        </div>
        <div className="max-w-[88%] self-end rounded-2xl rounded-br-md bg-primary px-2.5 py-1.5 text-[10px] leading-snug text-primary-foreground">
          Đã khóa 14:20 · bạn vẫn xem được phiếu.
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1.5 text-[10px] text-muted-foreground">
          <span className="flex-1">Nhập tin nhắn…</span>
          <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold text-primary-foreground">
            Gửi
          </span>
        </div>
      </div>
    ),
  },
  {
    id: "wizard",
    label: "Step wizard",
    wide: true,
    node: (
      <div className="w-full space-y-3 text-left">
        <div className="flex items-center gap-1">
          {["Chọn", "Ký", "Xuất"].map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-1">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                  i < 2 ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground",
                )}
              >
                {i < 2 ? "✓" : "3"}
              </span>
              <span className={cn("text-[10px]", i === 1 ? "font-semibold text-foreground" : "text-muted-foreground")}>
                {s}
              </span>
              {i < 2 ? <span className="mx-0.5 h-px flex-1 bg-primary/50" /> : null}
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2">
          <p className="text-[10px] font-medium text-primary">Bước 2 · Chữ ký</p>
          <p className="mt-0.5 text-[11px] text-foreground/90">Thủ kho đã ký · chờ chỉ huy</p>
        </div>
      </div>
    ),
  },
  {
    id: "analytics",
    label: "Analytics",
    wide: true,
    node: (
      <div className="w-full rounded-xl border border-border bg-card p-2.5 text-left shadow-soft">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Xuất kho · 7 ngày</p>
            <p className="text-lg font-semibold tabular-nums tracking-tight">128</p>
          </div>
          <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:text-emerald-400">
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
          <path d="M0 28 L20 22 L40 24 L60 14 L80 18 L100 8 L120 12 L120 36 L0 36 Z" fill="currentColor" opacity="0.12" />
        </svg>
      </div>
    ),
  },
  {
    id: "calendar",
    label: "Week schedule",
    wide: true,
    node: (
      <div className="w-full overflow-hidden rounded-xl border border-border bg-card text-left">
        <div className="grid grid-cols-5 border-b border-border text-center text-[9px] text-muted-foreground">
          {["T2", "T3", "T4", "T5", "T6"].map((d, i) => (
            <div key={d} className={cn("py-1", i === 2 && "bg-primary/10 font-semibold text-primary")}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-px bg-border p-px">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="min-h-[3.25rem] bg-card p-1">
              {i === 1 ? (
                <div className="rounded bg-primary/20 px-1 py-0.5 text-[8px] font-medium leading-tight text-primary">
                  Xuất
                </div>
              ) : null}
              {i === 2 ? (
                <div className="rounded bg-amber-500/20 px-1 py-0.5 text-[8px] font-medium leading-tight text-amber-800 dark:text-amber-300">
                  Họp
                </div>
              ) : null}
              {i === 4 ? (
                <div className="rounded bg-muted px-1 py-0.5 text-[8px] text-muted-foreground">QC</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "form",
    label: "Validated form",
    wide: true,
    node: (
      <div className="w-full space-y-2 text-left">
        <label className="block">
          <span className="text-[9px] font-medium text-muted-foreground">Email đơn vị</span>
          <div className="mt-0.5 rounded-lg border border-destructive/60 bg-background px-2.5 py-1.5 text-[11px]">
            kho@donvi
          </div>
          <p className="mt-0.5 text-[9px] text-destructive">Thiếu tên miền hợp lệ</p>
        </label>
        <label className="block">
          <span className="text-[9px] font-medium text-primary">Mã đơn vị</span>
          <div className="mt-0.5 rounded-lg border border-primary/50 bg-primary/5 px-2.5 py-1.5 text-[11px] font-medium">
            DV-024 · ✓
          </div>
        </label>
      </div>
    ),
  },
  {
    id: "tree",
    label: "File tree",
    node: (
      <ul className="w-full space-y-0.5 text-left font-mono text-[10px] leading-relaxed">
        <li className="text-muted-foreground">▾ sổ-bếp/</li>
        <li className="pl-3 font-medium text-foreground">· nx-lttp.xlsx</li>
        <li className="pl-3 text-muted-foreground">· chữ-ký/</li>
        <li className="pl-6 text-primary">· thu-kho.png</li>
        <li className="text-muted-foreground">▸ chứng-từ/</li>
      </ul>
    ),
  },
  {
    id: "funnel",
    label: "Funnel",
    node: (
      <div className="flex w-full flex-col items-center gap-1" aria-hidden>
        {[
          { w: "100%", n: "Phiếu 240" },
          { w: "78%", n: "Đã xuất 187" },
          { w: "52%", n: "Đối chiếu 125" },
          { w: "31%", n: "Khóa sổ 74" },
        ].map((s) => (
          <div
            key={s.n}
            className="rounded-sm bg-primary/80 py-1 text-center text-[8px] font-medium text-primary-foreground"
            style={{ width: s.w }}
          >
            {s.n}
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "heat",
    label: "Activity heat",
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
    label: "Receipt",
    node: (
      <div className="w-full rounded-xl border border-dashed border-border bg-muted/30 px-2.5 py-2 text-left text-[10px]">
        <p className="font-semibold">Phiếu xuất #1842</p>
        <div className="mt-1.5 space-y-0.5 text-muted-foreground">
          <div className="flex justify-between gap-2">
            <span>Gạo tẻ</span>
            <span className="tabular-nums text-foreground">42 kg</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Thịt heo</span>
            <span className="tabular-nums text-foreground">18 kg</span>
          </div>
        </div>
        <div className="mt-2 flex justify-between border-t border-border pt-1.5 font-medium">
          <span>Tổng</span>
          <span className="tabular-nums">2.4M</span>
        </div>
      </div>
    ),
  },
  {
    id: "notify",
    label: "Alert center",
    wide: true,
    node: (
      <div className="w-full overflow-hidden rounded-xl border border-border bg-card text-left shadow-soft">
        <div className="flex items-center justify-between border-b border-border px-2.5 py-1.5">
          <span className="text-[10px] font-semibold">Thông báo</span>
          <span className="rounded-full bg-destructive px-1.5 text-[9px] font-bold text-destructive-foreground">
            3
          </span>
        </div>
        <ul className="divide-y divide-border text-[10px]">
          {[
            { t: "Phiếu #1842 chờ ký", m: "2 phút" },
            { t: "Đồng bộ Drive xong", m: "1 giờ" },
            { t: "Quota còn 14%", m: "Hôm nay" },
          ].map((n) => (
            <li key={n.t} className="flex items-start justify-between gap-2 px-2.5 py-1.5">
              <span className="leading-snug">{n.t}</span>
              <span className="shrink-0 text-muted-foreground">{n.m}</span>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: "pricing",
    label: "Plan compare",
    wide: true,
    node: (
      <div className="grid w-full grid-cols-2 gap-2 text-left">
        <div className="rounded-xl border border-border bg-muted/40 px-2.5 py-2">
          <p className="text-[9px] text-muted-foreground">Starter</p>
          <p className="text-sm font-semibold tabular-nums">0</p>
          <p className="mt-1 text-[9px] text-muted-foreground">1 đơn vị</p>
        </div>
        <div className="rounded-xl border border-primary bg-primary/10 px-2.5 py-2 ring-1 ring-primary/30">
          <p className="text-[9px] font-medium text-primary">Pro</p>
          <p className="text-sm font-semibold tabular-nums">
            1.2M<span className="text-[9px] font-normal text-muted-foreground">/th</span>
          </p>
          <p className="mt-1 text-[9px] text-foreground/80">Offline · Drive · NCC</p>
        </div>
      </div>
    ),
  },
  {
    id: "passkey",
    label: "Passkey gate",
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
          <p className="font-semibold">Xác thực Passkey</p>
          <p className="text-muted-foreground">Touch ID / Face ID</p>
        </div>
      </div>
    ),
  },
];

function TileCard({ tile }) {
  return (
    <div
      className={cn(
        "ql-marquee-tile flex shrink-0 flex-col gap-2.5 rounded-2xl border border-border bg-card/95 p-4 shadow-soft backdrop-blur-sm",
        tile.wide ? "w-[17.5rem] sm:w-[19.5rem]" : "w-[14rem] sm:w-[15.5rem]",
      )}
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
      <div
        className={cn(
          "ql-marquee-track flex w-max gap-4 pr-4",
          reverse && "ql-marquee-track-reverse",
        )}
      >
        {loop.map((tile, i) => (
          <TileCard key={`${tile.id}-${i}`} tile={tile} />
        ))}
      </div>
    </div>
  );
}

/**
 * Infinite dual-row component banner — CSS translate loop (always running),
 * static wrap when prefers-reduced-motion.
 */
export function ComponentMarquee({ className }) {
  const rowA = TILES.slice(0, 8);
  const rowB = TILES.slice(7);

  return (
    <section
      className={cn("ql-marquee relative py-12 sm:py-16", className)}
      aria-label="Thư viện component craft"
    >
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

      <div className="ql-marquee-static mx-auto hidden max-w-6xl flex-wrap justify-center gap-4 px-4">
        {TILES.map((tile) => (
          <TileCard key={tile.id} tile={tile} />
        ))}
      </div>
    </section>
  );
}
