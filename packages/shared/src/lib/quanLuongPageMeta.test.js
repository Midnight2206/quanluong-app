import assert from "node:assert/strict";
import test from "node:test";
import {
  QUANLUONG_BRAND_LOGO_MARK_SRC,
  QUANLUONG_BRAND_LOGO_SRC,
  QUANLUONG_MANIFEST_PATH,
  QUANLUONG_SITE_NAME,
  QUANLUONG_SITE_SLOGAN,
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
  assert.equal(QUANLUONG_SITE_SLOGAN, "Hiện đại hoá công tác quản lý quân nhu");
  assert.equal(QUANLUONG_BRAND_LOGO_SRC, "/branding/logo.png");
  assert.equal(QUANLUONG_BRAND_LOGO_MARK_SRC, "/branding/logo-mark.png");
  assert.equal(QUANLUONG_MANIFEST_PATH, "/branding/site.webmanifest");
  assert.deepEqual(
    icons.icon.map((icon) => icon.url),
    [
      "/branding/favicon-64x64.png",
      "/branding/favicon-48x48.png",
      "/branding/favicon-32x32.png",
      "/branding/favicon-16x16.png",
      "/branding/favicon.ico",
    ],
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
