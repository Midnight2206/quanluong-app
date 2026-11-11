"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ClientRedirect } from "@/hocs/ClientRedirect";
import { useAuthInitialized, useIsAuthenticated } from "@/features/auth/model/authSlice";
import { MIDNIGHT_ABOUT, MIDNIGHT_CONTACT } from "@/lib/midnightContact";
import { QUANLUONG_BRAND_LOGO_MARK_SRC } from "@/lib/quanLuongPageMeta";
import { cn } from "@/utils/cn";
import { ComponentMarquee } from "./landing/ComponentMarquee";
import { Reveal } from "./landing/Reveal";

const SERVICES = [
  {
    key: "webapp",
    title: "Web app",
    lead: "Hệ thống nghiệp vụ nhiều vai trò, offline-aware, phân quyền chặt.",
    detail: "Từ sổ sách đơn vị đến cổng nhà cung cấp — một codebase, nhiều bề mặt.",
  },
  {
    key: "website",
    title: "Website",
    lead: "Landing và cổng thông tin có nhịp chuyển động có chủ đích.",
    detail: "Typography, màu brand và motion gắn với sản phẩm — không template generic.",
  },
  {
    key: "firmware",
    title: "Firmware",
    lead: "Lớp phần mềm gần phần cứng, ổn định và đo được.",
    detail: "Đồng bộ với cloud/app khi cần; ưu tiên độ tin cậy trên thiết bị thật.",
  },
];

const TECH_STACK = [
  {
    key: "frontend",
    title: "Frontend",
    tags: ["React", "Next.js", "TypeScript", "Tailwind CSS", "TanStack Query", "Zustand"],
    body: "Giao diện App Router rõ ranh giới server/client, theme và quyền đi cùng từng màn. React giữ nhịp tương tác; Next.js lo định tuyến, metadata và hiệu năng tải. TypeScript + Tailwind + lớp state/query giúp UI nhất quán, có thể offline khi nghiệp vụ đòi hỏi.",
  },
  {
    key: "backend",
    title: "Backend",
    tags: ["Node.js", "Express", "NestJS", "Prisma", "MariaDB", "Redis", "Socket.io", "BullMQ"],
    body: "API trên Node.js — Express khi cần mỏng và nhanh, NestJS khi hệ thống module hóa sâu. Prisma và MariaDB giữ hợp đồng dữ liệu; Redis cho session/cache; Socket.io cho realtime; BullMQ tách việc nền khỏi request để hệ thống chịu tải êm.",
  },
  {
    key: "delivery",
    title: "Vận hành & mở rộng",
    tags: ["Docker", "Python", "PWA", "Firmware"],
    body: "Đóng gói Docker để môi trường dev/prod khớp nhau. Python phục vụ xuất chứng từ và tài liệu nặng. PWA đưa web app sát thiết bị; firmware gắn phần cứng khi sản phẩm cần lớp gần máy — cùng kỷ luật đo lường và đồng bộ với cloud.",
  },
];

const btnBase =
  "inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

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

  if (!initialized) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">Đang tải…</div>
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
        <div className="ql-hero-stage flex max-w-3xl flex-col items-center gap-6">
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
            className="ql-hero-item max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            style={{ "--ql-hero-i": 2 }}
          >
            Xây web app, website và firmware — phần mềm có nhịp, có độ tin cậy, và có bản sắc.
          </p>
          <p
            className="ql-hero-item max-w-2xl text-sm leading-relaxed text-muted-foreground/90 sm:text-[0.95rem]"
            style={{ "--ql-hero-i": 3 }}
          >
            Studio thiết kế giao diện có chủ đích: component sống theo theme sáng/tối và accent, motion chỉ khi
            giúp định hướng — không trang trí thừa.
          </p>
          <div className="ql-hero-item flex flex-wrap items-center justify-center gap-3" style={{ "--ql-hero-i": 4 }}>
            <Link
              href="/login"
              className={cn(btnBase, "border border-primary bg-primary font-semibold text-primary-foreground shadow-soft hover:bg-primary/90")}
            >
              Đăng nhập
            </Link>
            <a
              href="#craft-strip"
              className={cn(
                btnBase,
                "border border-input bg-card text-foreground shadow-soft hover:border-primary/40 hover:bg-muted",
              )}
            >
              Xem giao diện
            </a>
          </div>
        </div>
      </section>

      <div id="craft-strip" className="relative scroll-mt-20 border-y border-border bg-muted/25">
        <div className="mx-auto max-w-5xl px-4 pb-2 pt-12 text-center sm:px-8 sm:pt-14">
          <Reveal>
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Giao diện có nhịp
            </h2>
          </Reveal>
        </div>
        <ComponentMarquee />
      </div>

      <section id="cong-nghe" className="relative scroll-mt-24 px-4 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Công nghệ Midnight nắm vững
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Chọn stack theo bài toán, không theo mốt. Frontend chịu trách nhiệm cảm giác và tốc độ; backend giữ hợp
              đồng dữ liệu và độ tin cậy; vận hành để sản phẩm sống được trên máy thật — không chỉ trên slide.
            </p>
          </Reveal>
          <div className="mt-14 space-y-12">
            {TECH_STACK.map((block, i) => (
              <Reveal key={block.key} delayMs={i * 70}>
                <article className="border-t border-border pt-8 md:grid md:grid-cols-12 md:gap-8">
                  <div className="md:col-span-4">
                    <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground sm:text-2xl">
                      {block.title}
                    </h3>
                    <ul className="mt-4 flex flex-wrap gap-2" aria-label={`Công nghệ ${block.title}`}>
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
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:col-span-8 md:mt-0 md:text-[0.95rem] md:leading-7">
                    {block.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-5xl px-4 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Ba bề mặt, một chuẩn craft
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Mỗi bề mặt có ngôn ngữ riêng; cùng kỷ luật về hiệu năng, truy cập và trải nghiệm.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-10 md:grid-cols-12 md:gap-6">
          {SERVICES.map((s, i) => (
            <Reveal
              key={s.key}
              delayMs={i * 90}
              className={cn(i === 0 ? "md:col-span-5" : i === 1 ? "md:col-span-4" : "md:col-span-3")}
            >
              <article className="border-t border-border pt-5">
                <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground sm:text-2xl">
                  {s.title}
                </p>
                <p className="mt-3 text-sm font-medium text-foreground/90">{s.lead}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.detail}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <footer
        id="lien-he"
        className="relative border-t border-border bg-card/70 px-4 py-14 sm:px-8 sm:py-16 lg:px-10"
      >
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-12 md:gap-8 lg:gap-12">
          <div className="md:col-span-5 lg:col-span-5">
            <p className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
              <span className="ql-brand-text">Midnight</span>
            </p>
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
              Về chúng tôi
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{MIDNIGHT_ABOUT}</p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <Link href="/login" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Đăng ký
              </Link>
            </div>
          </div>

          <div className="md:col-span-7 lg:col-span-7">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">Liên hệ</h2>
            <p className="mt-2 text-sm text-muted-foreground">Gửi tin qua kênh bạn tiện nhất.</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {Object.values(MIDNIGHT_CONTACT).map((item) => {
                const Icon = item.Icon;
                const external = item.href?.startsWith("http");
                return (
                  <li key={item.label}>
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
                          {item.label}
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
