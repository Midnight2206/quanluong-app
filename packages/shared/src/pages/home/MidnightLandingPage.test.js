import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getMidnightCopy, midnightLandingMeta, MIDNIGHT_COPY } from "../../lib/midnightLandingCopy.js";
import {
  MIDNIGHT_LANG_INIT_SCRIPT,
  MIDNIGHT_LOCALE_COOKIE,
  normalizeMidnightLocale,
} from "../../lib/midnightLocale.js";
import { quanLuongPageMeta } from "../../lib/quanLuongPageMeta.js";

const landing = readFileSync(new URL("./MidnightLandingPage.jsx", import.meta.url), "utf8");
const marketingLayout = readFileSync(new URL("../../layouts/MarketingLayout.jsx", import.meta.url), "utf8");
const home = readFileSync(new URL("./HomePage.jsx", import.meta.url), "utf8");
const publicOnly = readFileSync(new URL("../../hocs/PublicOnlyRoute.jsx", import.meta.url), "utf8");
const marketingPage = readFileSync(
  new URL("../../../../../apps/web/app/(marketing)/page.jsx", import.meta.url),
  "utf8",
);
const rootLayout = readFileSync(new URL("../../../../../apps/web/app/layout.jsx", import.meta.url), "utf8");
const localeUi = readFileSync(new URL("../../lib/midnightLocale.jsx", import.meta.url), "utf8");

function leafPaths(value, prefix = "") {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => leafPaths(item, `${prefix}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.keys(value).flatMap((key) => leafPaths(value[key], prefix ? `${prefix}.${key}` : key));
  }
  return [prefix];
}

test("landing is Midnight studio (services + tech + contact footer) with auth redirect", () => {
  assert.match(landing, /MidnightLandingPage/);
  assert.match(landing, /useMidnightLocale/);
  assert.match(landing, /ComponentMarquee/);
  assert.match(landing, /MIDNIGHT_CONTACT/);
  assert.match(landing, /item\.about\.title/);
  assert.match(landing, /item\.contact\.title/);
  assert.doesNotMatch(landing, /Case study|CraftOrbit|quan-luong/);
  assert.doesNotMatch(landing, /có nhịp|chuẩn craft|không chỉ trên slide/);
  assert.match(landing, /publicOnlyRedirectPath\(user, loc\)/);
  assert.match(landing, /driveCallback \? `\/profile\?\$\{qs\}`/);
  assert.doesNotMatch(landing, /window\.location\.replace/);
  assert.doesNotMatch(landing, /googleDriveFolderId|startGoogleDriveLink/);
});

test("midnight copy is Vietnamese by default, English in parallel, and technically scoped", () => {
  assert.deepEqual(leafPaths(MIDNIGHT_COPY.vi), leafPaths(MIDNIGHT_COPY.en));
  assert.equal(normalizeMidnightLocale("en"), "en");
  assert.equal(normalizeMidnightLocale("EN"), "vi");
  assert.equal(normalizeMidnightLocale(undefined), "vi");
  assert.equal(MIDNIGHT_LOCALE_COOKIE, "midnight_lang");

  const vi = getMidnightCopy("vi");
  const en = getMidnightCopy("en");
  const productTags = vi.tech.blocks.flatMap((block) => block.tags);
  assert.ok(productTags.includes("Next.js"));
  assert.ok(productTags.includes("TanStack Query"));
  assert.ok(productTags.includes("Zustand"));
  assert.ok(productTags.includes("Prisma"));
  assert.ok(productTags.includes("BullMQ"));
  assert.equal(productTags.includes("NestJS"), false);
  assert.equal(productTags.includes("TypeScript"), false);
  assert.deepEqual(vi.tech.studioTags, ["TypeScript", "NestJS"]);
  assert.match(vi.tech.studioLead, /JavaScript/);
  assert.match(vi.tech.studioLead, /không dùng NestJS/);
  assert.match(vi.tech.blocks[1].body, /hàng đợi tác vụ nền/);
  assert.match(vi.tech.blocks[1].body, /thời gian thực/);
  assert.match(vi.hero.support, /phân quyền theo vai trò \(RBAC\)/);
  assert.match(vi.services.items[0].detail, /offline-first/);
  assert.match(vi.services.items[0].detail, /đồng bộ dữ liệu/);
  assert.equal(vi.strip.title, "Mẫu giao diện");
  assert.equal(en.strip.title, "Interface samples");
  assert.match(vi.marquee.aria, /Mẫu giao diện/);
  assert.doesNotMatch(JSON.stringify(MIDNIGHT_COPY), /có nhịp|không chỉ trên slide|Passkey|1\.2M/);
  assert.notEqual(vi.meta.description, en.meta.description);
  assert.equal(vi.loading, "Đang tải…");
  assert.equal(en.loading, "Loading…");

  const meta = midnightLandingMeta("en");
  assert.equal(meta.ogLocale, "en_US");
  assert.equal(meta.documentTitle, "Quân lương - Midnight");
  const pageMeta = quanLuongPageMeta({ title: meta.title, description: meta.description, locale: "en" });
  assert.equal(pageMeta.openGraph.locale, "en_US");
  assert.equal(quanLuongPageMeta({ title: "Midnight", description: "x" }).openGraph.locale, "vi_VN");
});

test("midnight contact links stay on the official channels", () => {
  const contact = readFileSync(new URL("../../lib/midnightContact.jsx", import.meta.url), "utf8");
  assert.match(contact, /zalo\.me\/0386206503/);
  assert.match(contact, /facebook\.com\/tran\.van\.khanh\.749250/);
  assert.match(contact, /mailto:midnight\.tvk\.96@gmail\.com/);
  assert.match(contact, /tel:\+84386206503/);
  assert.match(contact, /0386\.206\.503/);
  assert.match(contact, /ZaloIcon|FacebookIcon|GmailIcon/);
  assert.match(contact, /MIDNIGHT_ABOUT/);
  assert.equal(getMidnightCopy("vi").contact.labels.phone, "Điện thoại");
  assert.equal(getMidnightCopy("en").contact.labels.phone, "Phone");
});

test("component marquee ships fifteen sample tiles and dual-row loop", () => {
  const marquee = readFileSync(new URL("./landing/ComponentMarquee.jsx", import.meta.url), "utf8");
  assert.match(marquee, /ComponentMarquee/);
  assert.match(marquee, /ql-marquee-track-reverse/);
  assert.match(marquee, /copy\.aria/);
  assert.equal((marquee.match(/\bid:\s*"/g) || []).length, 15);
  assert.doesNotMatch(marquee, /Passkey|Starter|craft/);
});

test("locale text reserves every language so controls do not resize", () => {
  assert.match(localeUi, /export function LocaleText/);
  assert.match(localeUi, /MIDNIGHT_LOCALES\.map/);
  assert.match(localeUi, /invisible/);
  assert.doesNotMatch(localeUi, /truncate|text-ellipsis|line-clamp/);
  assert.match(landing, /LocaleText/);
  assert.match(marketingLayout, /LocaleText/);
  assert.match(marketingLayout, /data-control="header-login"/);
  assert.match(landing, /data-control="hero-samples"/);
  assert.match(landing, /data-control="footer-login"/);
});

test("marketing shell has a language switcher and no app chrome", () => {
  assert.match(marketingLayout, /MarketingLayout/);
  assert.match(marketingLayout, /MidnightLocaleProvider/);
  assert.match(marketingLayout, /aria-pressed/);
  assert.doesNotMatch(marketingLayout, /AppSidebar|MessengerChatDock|MainLayout/);
  assert.match(marketingLayout, /ThemePicker variant="popover"/);
  assert.match(marketingLayout, /bg-background/);
  assert.match(marketingLayout, /bg-primary/);
  assert.doesNotMatch(marketingLayout, /bg-\[#05050f\]/);
});

test("marketing metadata and html lang follow the locale cookie", () => {
  assert.match(marketingPage, /generateMetadata/);
  assert.match(marketingPage, /MIDNIGHT_LOCALE_COOKIE/);
  assert.match(rootLayout, /MIDNIGHT_LANG_INIT_SCRIPT/);
  assert.match(MIDNIGHT_LANG_INIT_SCRIPT, /midnight_lang/);
  assert.match(MIDNIGHT_LANG_INIT_SCRIPT, /pathname/);
});

test("workspace HomePage sends only superadmin to dashboard and does not bounce others", () => {
  assert.match(home, /isSuperadminUser\(user\)/);
  assert.match(home, /ClientRedirect href="\/dashboard"/);
  assert.match(home, /Trang làm việc/);
  assert.doesNotMatch(home, /if \(isAuthenticated\) \{\s*return <ClientRedirect href="\/dashboard"/);
});

test("PublicOnlyRoute sends signed-in users through publicOnlyRedirectPath not marketing home", () => {
  assert.match(publicOnly, /publicOnlyRedirectPath\(user, loc\)/);
  assert.doesNotMatch(publicOnly, /href="\/"/);
  assert.doesNotMatch(publicOnly, /window\.location\.replace/);
});
