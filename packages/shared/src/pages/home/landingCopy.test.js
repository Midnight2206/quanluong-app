import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_LANDING_LOCALE,
  LANDING_LOCALES,
  LANDING_LOCALE_COOKIE,
  formatLandingGreeting,
  getLandingCopy,
  landingCopy,
  landingLocaleSetCookie,
  landingRouteMetadata,
  resolveLandingLocale,
} from "./landingCopy.js";

const BANNED = [/telegram/i, /google workspace/i, /ký số/i, /digital signature/i, /thông minh/i];

function leafEntries(value, prefix = "") {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => leafEntries(item, `${prefix}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .flatMap((key) => leafEntries(value[key], prefix ? `${prefix}.${key}` : key));
  }
  return [[prefix, value]];
}

test("locale resolution falls back to Vietnamese", () => {
  assert.deepEqual(LANDING_LOCALES, ["vi", "en"]);
  assert.equal(DEFAULT_LANDING_LOCALE, "vi");
  assert.equal(resolveLandingLocale(undefined), "vi");
  assert.equal(resolveLandingLocale(" EN "), "en");
  assert.equal(resolveLandingLocale("fr"), "vi");
  assert.equal(getLandingCopy("nope").htmlLang, "vi");
});

test("every locale has the same non-empty strings", () => {
  const base = leafEntries(landingCopy.vi).map(([key]) => key);
  for (const code of LANDING_LOCALES) {
    const entries = leafEntries(landingCopy[code]);
    assert.deepEqual(
      entries.map(([key]) => key),
      base,
      code,
    );
    for (const [key, value] of entries) {
      assert.equal(typeof value, "string", `${code} ${key}`);
      assert.ok(value.trim().length > 0, `${code} ${key}`);
    }
  }
  assert.equal(landingCopy.vi.features.length, 4);
  assert.equal(landingCopy.vi.steps.length, 4);
  assert.equal(landingCopy.vi.security.length, 6);
});

test("copy does not repeat claims the product does not make", () => {
  const blob = JSON.stringify(landingCopy);
  for (const pattern of BANNED) {
    assert.equal(pattern.test(blob), false, pattern.source);
  }
  assert.match(landingCopy.vi.heroTitle, /đơn vị|LTTP|Sổ/);
  assert.match(landingCopy.vi.features[3].body, /chấp nhận/);
  assert.match(landingCopy.en.features[3].body, /accept/);
  assert.notEqual(landingCopy.vi.heroTitle, landingCopy.en.heroTitle);
  assert.match(JSON.stringify(landingCopy.vi), /[ăâêôơưđĂÂÊÔƠƯĐ]/);
});

test("greeting and metadata follow the locale", () => {
  assert.equal(formatLandingGreeting(landingCopy.vi, "  Lan  "), "Xin chào, Lan");
  assert.equal(formatLandingGreeting(landingCopy.vi, "   "), "Xin chào");
  assert.equal(formatLandingGreeting(landingCopy.en, ""), "Hello");
  const english = landingRouteMetadata("en");
  assert.equal(english.title, "Home");
  assert.equal(english.openGraph.locale, "en_US");
  assert.match(english.description, /draft/);
  const fallback = landingRouteMetadata("zz");
  assert.equal(fallback.openGraph.locale, "vi_VN");
  assert.equal(fallback.title, "Trang chủ");
});

test("locale cookie is persistent and limited to known codes", () => {
  const cookie = landingLocaleSetCookie("en");
  assert.match(cookie, new RegExp(`^${LANDING_LOCALE_COOKIE}=en;`));
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Max-Age=31536000/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(landingLocaleSetCookie("fr"), new RegExp(`^${LANDING_LOCALE_COOKIE}=vi;`));
});
