import assert from "node:assert/strict";
import test from "node:test";
import {
  QUANLUONG_BRAND_LOGO_SRC,
  QUANLUONG_MANIFEST_PATH,
  QUANLUONG_SITE_NAME,
  quanLuongIcons,
} from "./quanLuongPageMeta.js";

const originalIcon = process.env.NEXT_PUBLIC_SITE_ICON;

test.afterEach(() => {
  if (originalIcon === undefined) delete process.env.NEXT_PUBLIC_SITE_ICON;
  else process.env.NEXT_PUBLIC_SITE_ICON = originalIcon;
});

test("default icons point at the Midnight branding set", () => {
  delete process.env.NEXT_PUBLIC_SITE_ICON;
  const icons = quanLuongIcons();
  assert.equal(QUANLUONG_SITE_NAME, "Quân lương");
  assert.equal(QUANLUONG_BRAND_LOGO_SRC, "/branding/logo.png");
  assert.equal(QUANLUONG_MANIFEST_PATH, "/branding/site.webmanifest");
  assert.deepEqual(
    icons.icon.map((icon) => icon.url),
    ["/branding/favicon.ico", "/branding/favicon-32x32.png", "/branding/favicon-16x16.png"],
  );
  assert.equal(icons.shortcut, "/branding/favicon.ico");
  assert.equal(icons.apple[0].url, "/branding/apple-touch-icon.png");
  assert.equal(icons.apple[0].sizes, "180x180");
});

test("NEXT_PUBLIC_SITE_ICON overrides the icon set with one URL", () => {
  process.env.NEXT_PUBLIC_SITE_ICON = "  /custom/mark.svg  ";
  const icons = quanLuongIcons();
  assert.deepEqual(icons.icon, [{ url: "/custom/mark.svg", type: "image/svg+xml" }]);
  assert.equal(icons.shortcut, "/custom/mark.svg");
  assert.deepEqual(icons.apple, [{ url: "/custom/mark.svg" }]);
});
