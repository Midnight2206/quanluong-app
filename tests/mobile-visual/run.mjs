/**
 * Chụp mọi page Next (web + superadmin) ở 4 kích thước.
 *
 *   npm run test:mobile-visual -- before
 *   npm run test:mobile-visual -- after
 *   npm run test:mobile-visual -- compare
 *
 * `before` / `after` ghi PNG vào tests/mobile-visual/output/<nhãn>/
 * và /opt/cursor/artifacts/mobile-visual/<nhãn>/ khi thư mục artifacts có sẵn.
 * `compare` đối chiếu pixel desktop 1440×900. `after` cũng fail nếu mobile còn
 * tràn ngang, input < 16px, hoặc control < 44px (trừ trang sổ).
 *
 * Cần Chromium của Playwright: npx playwright install chromium
 */
import { spawn } from "node:child_process";
import { mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { APPS, VIEWPORTS, shotName } from "./pages.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mode = process.argv[2] || "after";
const outRoot = join(root, "tests/mobile-visual/output");
const artifactRoot = "/opt/cursor/artifacts/mobile-visual";

const PERMISSIONS = [
  "users.read", "users.create", "users.patch", "users.put", "users.delete", "users.detail",
  "units.read", "units.detail", "units.create", "units.patch", "units.delete",
  "registrations.read", "registrations.review",
  "jobTitles.read", "jobTitles.detail", "jobTitles.create", "jobTitles.patch", "jobTitles.delete",
  "permissions.read", "permissions.patch",
  "lttp.commodities.read", "lttp.commodities.write", "lttp.prices.read", "lttp.prices.write",
  "lttp.groups.read", "lttp.groups.manage", "lttp.issue-slips.read", "lttp.issue-slips.write",
  "mealAllowanceRates.manage", "mealRoster.access",
  "kitchenBooks.access", "kitchenBooks.view", "kitchenBooks.save",
];

function persona(kind) {
  const base = {
    id: 1,
    username: kind === "superadmin" ? "superadmin" : "beptruong",
    email: "visual@example.com",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    profile: { fullName: kind === "superadmin" ? "Quản trị hệ thống" : "Nguyễn Văn A" },
    unit: { id: 1, name: "Bếp mẫu", path: "/1/" },
    permissions: PERMISSIONS.map((code) => ({ code })),
  };
  if (kind === "superadmin") {
    return { ...base, type: { id: 1, name: "superadmin" } };
  }
  return { ...base, type: { id: 2, name: "admin" } };
}

const UNITS = [{ id: 1, name: "Bếp mẫu", path: "/1/", code: "BEP" }];

const LEDGER = {
  status: "draft",
  canEdit: true,
  canLock: false,
  canExport: true,
  slipCount: 1,
  lines: [
    { tt: 1, name: "Gạo tẻ", uom: "kg", unitPrice: 18000, openingQty: 12, openingAmount: 216000 },
  ],
  structure: {
    dateLine: "Ngày 01 tháng 11 năm 2026",
    rows: [
      { tt: 1, name: "Gạo tẻ", uom: "kg", unitPrice: 18000, openingQty: 12, openingAmount: 216000 },
    ],
    totals: { openingAmount: 216000 },
    financeLines: [],
    finance: {},
    headcount: { meals: [], extras: [] },
  },
  settings: { signatures: {} },
  mealRates: {},
  warnings: [],
  blockers: [],
  manualEntryCount: 0,
  priceTable: { effectiveDate: "2026-11-01" },
};

function json(route, data) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, data }),
  });
}

async function mockApi(page, kind) {
  const user = persona(kind);
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.includes("/auth/current-user")) return json(route, user);
    if (path.includes("/auth/register-units")) return json(route, UNITS);
    if (route.request().method() === "GET" && /\/units\/?$/.test(path)) return json(route, UNITS);
    if (path.includes("/kitchen-books/ledger")) return json(route, LEDGER);
    if (path.includes("/conversations") || path.includes("/notifications")) return json(route, []);
    return json(route, []);
  });
  await page.route("**/socket.io/**", (route) => route.abort());
}

async function waitForServer(port) {
  const deadline = Date.now() + 180000;
  let last = "";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/login`, { redirect: "manual" });
      if (res.status < 500) return;
      last = String(res.status);
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server :${port} không lên (${last})`);
}

function startApp(app) {
  const child = spawn("npm", ["run", "dev", "-w", app.workspace], {
    cwd: root,
    env: { ...process.env, BROWSER: "none", NEXT_TELEMETRY_DISABLED: "1" },
    detached: true,
    stdio: "ignore",
  });
  return child;
}

function stopChild(child) {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  }
}

async function measure(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const docOverflow = document.documentElement.scrollWidth - vw;
    const offenders = [];
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest("nextjs-portal, [data-nextjs-toast], [data-next-badge]")) continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (rect.right <= vw + 2 && rect.left >= -2) continue;
      if (el.closest("[aria-hidden='true'], .sr-only")) continue;
      let node = el.parentElement;
      let framed = false;
      let clippedLocally = false;
      while (node && node !== document.documentElement) {
        const ox = getComputedStyle(node).overflowX;
        if (ox === "auto" || ox === "scroll") {
          framed = true;
          break;
        }
        if (
          (ox === "hidden" || ox === "clip") &&
          node !== document.body &&
          node.getAttribute("data-page-scroll-owner") !== "true"
        ) {
          clippedLocally = true;
        }
        node = node.parentElement;
      }
      if (!framed && !clippedLocally && offenders.length < 6) {
        offenders.push({
          tag: el.tagName,
          cls: String(el.className).slice(0, 140),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        });
      }
    }
    const issues = [];
    const controls = document.querySelectorAll("button, a, [role='button'], [role='tab'], input, select, textarea, summary");
    for (const el of controls) {
      if (el.closest(".ledger-paper, .bkmh-print-root, .bkmh-a4-print-host, .sr-only, nextjs-portal, [data-nextjs-toast], [data-next-badge]")) continue;
      if (el.classList?.contains("sr-only")) continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      const tag = el.tagName;
      const type = (el.getAttribute("type") || "").toLowerCase();
      const isTextField =
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (tag === "INPUT" && !["checkbox", "radio", "range", "hidden", "button", "submit", "reset", "image", "file"].includes(type));
      if (isTextField) {
        const fs = Number.parseFloat(style.fontSize);
        if (fs < 16 && issues.length < 8) {
          issues.push({ kind: "font", fs, cls: String(el.className).slice(0, 100) });
        }
        continue;
      }
      const role = el.getAttribute("role");
      if (tag === "A" && !el.closest("header, nav") && role !== "tab" && role !== "button") continue;
      if (rect.width > vw * 0.85 && rect.height > vh * 0.85) continue;
      if ((rect.width < 44 || rect.height < 44) && issues.length < 8) {
        issues.push({
          kind: "touch",
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          tag,
          cls: String(el.className).slice(0, 100),
        });
      }
    }
    return {
      docOverflow,
      offenders,
      issues,
      title: document.title,
      url: location.pathname,
    };
  });
}

function saveShot(buf, dir, name) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, name);
  writeFileSync(file, buf);
  if (existsSync("/opt/cursor/artifacts")) {
    const mirror = join(artifactRoot, dir.endsWith("before") ? "before" : dir.endsWith("after") ? "after" : "other");
    mkdirSync(mirror, { recursive: true });
    copyFileSync(file, join(mirror, name));
  }
  return file;
}

function diffDesktop(beforeDir, afterDir) {
  const rows = [];
  let failed = 0;
  for (const app of APPS) {
    for (const pagePath of app.pages) {
      const name = shotName(app.id, pagePath, "1440x900");
      const a = join(beforeDir, name);
      const b = join(afterDir, name);
      if (!existsSync(a) || !existsSync(b)) {
        rows.push({ name, status: "missing" });
        failed += 1;
        continue;
      }
      const imgA = PNG.sync.read(readFileSync(a));
      const imgB = PNG.sync.read(readFileSync(b));
      if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
        rows.push({
          name,
          status: "size",
          before: `${imgA.width}x${imgA.height}`,
          after: `${imgB.width}x${imgB.height}`,
        });
        failed += 1;
        continue;
      }
      const diff = new PNG({ width: imgA.width, height: imgA.height });
      const count = pixelmatch(imgA.data, imgB.data, diff.data, imgA.width, imgA.height, { threshold: 0.1 });
      const ratio = count / (imgA.width * imgA.height);
      if (count > 0) {
        const diffName = name.replace(/\.png$/, ".diff.png");
        const diffDir = join(outRoot, "desktop-diff");
        mkdirSync(diffDir, { recursive: true });
        writeFileSync(join(diffDir, diffName), PNG.sync.write(diff));
        if (existsSync("/opt/cursor/artifacts")) {
          mkdirSync(join(artifactRoot, "desktop-diff"), { recursive: true });
          copyFileSync(join(diffDir, diffName), join(artifactRoot, "desktop-diff", diffName));
        }
        rows.push({ name, status: "diff", pixels: count, ratio });
        failed += 1;
      } else {
        rows.push({ name, status: "match" });
      }
    }
  }
  return { failed, rows };
}

async function probeDialog(page) {
  return page.evaluate(() => {
    const host = document.createElement("div");
    host.className = "fixed inset-0 z-[80] flex items-center justify-center p-4";
    host.innerHTML = '<div role="dialog" aria-modal="true" class="max-w-md rounded-xl bg-card" style="width:200px;height:120px"></div>';
    document.body.appendChild(host);
    const box = host.querySelector("[role=dialog]").getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    host.remove();
    return { w: Math.round(box.width), h: Math.round(box.height), vw, vh };
  });
}

async function capture(label) {
  const assertMobile = label === "after";
  const dir = join(outRoot, label);
  mkdirSync(dir, { recursive: true });
  const children = APPS.map((app) => ({ app, child: startApp(app) }));
  const findings = [];
  const browser = await chromium.launch({ headless: true });
  try {
    await Promise.all(APPS.map((app) => waitForServer(app.port)));
    for (const app of APPS) {
      const context = await browser.newContext({
        locale: "vi-VN",
        timezoneId: "Asia/Ho_Chi_Minh",
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
      });
      await context.addCookies([
        { name: "ql.at", value: "visual-session", url: `http://127.0.0.1:${app.port}` },
      ]);
      await context.addInitScript(() => {
        const fixed = Date.parse("2026-11-01T01:00:00.000Z");
        const Original = Date;
        class FrozenDate extends Original {
          constructor(...args) {
            if (args.length === 0) super(fixed);
            else super(...args);
          }
          static now() {
            return fixed;
          }
        }
        FrozenDate.UTC = Original.UTC;
        FrozenDate.parse = Original.parse;
        window.Date = FrozenDate;
      });
      const only = (process.env.MOBILE_VISUAL_ONLY || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const pages = only.length
        ? app.pages.filter((pagePath) => only.includes(`${app.id}:${pagePath}`))
        : app.pages;
      const viewports = process.env.MOBILE_VISUAL_VIEWPORTS
        ? VIEWPORTS.filter((viewport) =>
            process.env.MOBILE_VISUAL_VIEWPORTS.split(",").includes(viewport.name),
          )
        : VIEWPORTS;
      for (const pagePath of pages) {
        for (const viewport of viewports) {
          const page = await context.newPage();
          await mockApi(page, app.persona);
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          const url = `http://127.0.0.1:${app.port}${pagePath}`;
          let navError = null;
          try {
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
            await page.waitForTimeout(400);
            await page
              .waitForFunction(() => !/Đang tải/.test(document.body?.innerText || ""), { timeout: 8000 })
              .catch(() => {});
            await page.addStyleTag({
              content:
                "nextjs-portal,[data-nextjs-toast],[data-next-badge]{display:none !important} *,*::before,*::after{animation:none !important;transition:none !important;caret-color:transparent !important;}",
            });
            await page.evaluate(() => document.fonts?.ready);
          } catch (err) {
            navError = err instanceof Error ? err.message : String(err);
          }
          const name = shotName(app.id, pagePath, viewport.name);
          const buf = await page.screenshot({ type: "png", animations: "disabled" });
          saveShot(buf, dir, name);
          let metrics = null;
          if (!navError) {
            try {
              metrics = await measure(page);
            } catch (err) {
              navError = err instanceof Error ? err.message : String(err);
            }
          }
          const mobileIssues = !viewport.desktop && metrics
            ? [
                ...(metrics.docOverflow > 1 ? [{ kind: "page-overflow", px: metrics.docOverflow }] : []),
                ...metrics.offenders.map((row) => ({ kind: "unframed", ...row })),
                ...metrics.issues,
              ]
            : [];
          if (label === "after" && pagePath === "/login" && !navError) {
            const dialog = await probeDialog(page);
            const full = dialog.w >= dialog.vw - 2 && dialog.h >= dialog.vh - 2;
            if (viewport.desktop ? full : !full) {
              findings.push({
                app: app.id,
                path: pagePath,
                viewport: viewport.name,
                desktop: Boolean(viewport.desktop),
                navError: viewport.desktop
                  ? `Dialog desktop bị full màn hình ${dialog.w}x${dialog.h}`
                  : `Dialog mobile chưa full màn hình ${dialog.w}x${dialog.h} trong ${dialog.vw}x${dialog.vh}`,
                title: metrics?.title ?? null,
                mobileIssues: [],
              });
            }
          }
          findings.push({
            app: app.id,
            path: pagePath,
            viewport: viewport.name,
            desktop: Boolean(viewport.desktop),
            finalUrl: navError ? null : page.url(),
            navError,
            title: metrics?.title ?? null,
            mobileIssues,
          });
          await page.close();
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
    for (const { child } of children) stopChild(child);
  }

  const report = {
    label,
    capturedAt: new Date().toISOString(),
    pages: findings,
  };
  const partial = Boolean(process.env.MOBILE_VISUAL_ONLY);
  const reportName = partial ? "report.partial.json" : "report.json";
  writeFileSync(join(dir, reportName), JSON.stringify(report, null, 2));
  if (existsSync("/opt/cursor/artifacts")) {
    mkdirSync(join(artifactRoot, label), { recursive: true });
    copyFileSync(join(dir, reportName), join(artifactRoot, label, reportName));
  }

  if (!assertMobile || partial) {
    console.log(`Đã chụp ${findings.length} ảnh vào ${dir}`);
    return;
  }

  const bad = findings.filter((row) => row.navError || row.mobileIssues.length > 0);
  if (bad.length) {
    console.error(JSON.stringify(bad.slice(0, 40), null, 2));
    throw new Error(`${bad.length} trang mobile còn lỗi hoặc không mở được`);
  }
  console.log(`Mobile đạt trên ${findings.filter((row) => !row.desktop).length} ảnh`);
}

async function compare() {
  const beforeDir = join(outRoot, "before");
  const afterDir = join(outRoot, "after");
  const result = diffDesktop(beforeDir, afterDir);
  writeFileSync(join(outRoot, "desktop-compare.json"), JSON.stringify(result, null, 2));
  if (existsSync("/opt/cursor/artifacts")) {
    mkdirSync(artifactRoot, { recursive: true });
    copyFileSync(join(outRoot, "desktop-compare.json"), join(artifactRoot, "desktop-compare.json"));
  }
  const matched = result.rows.filter((row) => row.status === "match").length;
  console.log(`Desktop trùng pixel: ${matched}/${result.rows.length}`);
  if (result.failed) {
    console.error(JSON.stringify(result.rows.filter((row) => row.status !== "match"), null, 2));
    throw new Error(`${result.failed} ảnh desktop khác nhau`);
  }
}

if (mode === "compare") {
  await compare();
} else if (mode === "before" || mode === "after") {
  await capture(mode);
} else {
  throw new Error("Dùng before | after | compare");
}
