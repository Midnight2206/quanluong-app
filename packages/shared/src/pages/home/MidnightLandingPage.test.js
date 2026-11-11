import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const landing = readFileSync(new URL("./MidnightLandingPage.jsx", import.meta.url), "utf8");
const marketingLayout = readFileSync(
  new URL("../../layouts/MarketingLayout.jsx", import.meta.url),
  "utf8",
);
const home = readFileSync(new URL("./HomePage.jsx", import.meta.url), "utf8");
const publicOnly = readFileSync(new URL("../../hocs/PublicOnlyRoute.jsx", import.meta.url), "utf8");

test("landing is Midnight studio (services + tech + contact footer) with auth redirect", () => {
  assert.match(landing, /MidnightLandingPage/);
  assert.match(landing, /Web app/);
  assert.match(landing, /Firmware/);
  assert.match(landing, /ComponentMarquee/);
  assert.match(landing, /Giao diện có nhịp/);
  assert.match(landing, /Công nghệ Midnight nắm vững/);
  assert.match(landing, /NestJS/);
  assert.match(landing, /Next\.js/);
  assert.match(landing, /MIDNIGHT_CONTACT/);
  assert.match(landing, /Về chúng tôi/);
  assert.match(landing, /Liên hệ/);
  assert.doesNotMatch(landing, /Case study|CraftOrbit|quan-luong/);
  assert.doesNotMatch(landing, /mock dày hơn/);
  assert.match(landing, /ClientRedirect href=\{driveCallback \? `\/profile\?\$\{qs\}` : "\/dashboard"\}/);
  assert.doesNotMatch(landing, /googleDriveFolderId|startGoogleDriveLink/);
});

test("midnight contact links and brand icons are wired", () => {
  const contact = readFileSync(new URL("../../lib/midnightContact.jsx", import.meta.url), "utf8");
  assert.match(contact, /zalo\.me\/0386206503/);
  assert.match(contact, /facebook\.com\/tran\.van\.khanh\.749250/);
  assert.match(contact, /mailto:midnight\.tvk\.96@gmail\.com/);
  assert.match(contact, /tel:\+84386206503/);
  assert.match(contact, /ZaloIcon|FacebookIcon|GmailIcon/);
  assert.match(contact, /MIDNIGHT_ABOUT/);
});

test("component marquee ships fifteen craft tiles and dual-row loop", () => {
  const marquee = readFileSync(new URL("./landing/ComponentMarquee.jsx", import.meta.url), "utf8");
  assert.match(marquee, /ComponentMarquee/);
  assert.match(marquee, /ql-marquee-track-reverse/);
  assert.equal((marquee.match(/\bid:\s*"/g) || []).length, 15);
});

test("marketing shell has no MainLayout chrome and theme-aware chrome", () => {
  assert.match(marketingLayout, /MarketingLayout/);
  assert.doesNotMatch(marketingLayout, /AppSidebar|MessengerChatDock|MainLayout/);
  assert.match(marketingLayout, /ThemePicker variant="popover"/);
  assert.match(marketingLayout, /bg-background/);
  assert.match(marketingLayout, /bg-primary/);
  assert.doesNotMatch(marketingLayout, /bg-\[#05050f\]/);
});

test("app HomePage redirects signed-in users to dashboard", () => {
  assert.match(home, /ClientRedirect href="\/dashboard"/);
});

test("PublicOnlyRoute sends signed-in users to dashboard not marketing home", () => {
  assert.match(publicOnly, /href="\/dashboard"/);
  assert.doesNotMatch(publicOnly, /href="\/"/);
});
