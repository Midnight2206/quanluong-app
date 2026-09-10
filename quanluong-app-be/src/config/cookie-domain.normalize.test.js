import test from "node:test";
import assert from "node:assert/strict";

import { normalizeCookieDomain } from "./cookie-domain.js";

test("COOKIE_DOMAIN normalizes to leading-dot parent domain", () => {
  assert.equal(normalizeCookieDomain(".trankhanhan.site"), ".trankhanhan.site");
  assert.equal(normalizeCookieDomain("trankhanhan.site"), ".trankhanhan.site");
  assert.equal(
    normalizeCookieDomain("https://trankhanhan.site/"),
    ".trankhanhan.site",
  );
});

test("COOKIE_DOMAIN equal to PUBLIC_WEB_URL host is lifted to parent", () => {
  assert.equal(
    normalizeCookieDomain(
      "quanluong.trankhanhan.site",
      "https://quanluong.trankhanhan.site",
    ),
    ".trankhanhan.site",
  );
  assert.equal(
    normalizeCookieDomain(
      ".quanluong.trankhanhan.site",
      "https://quanluong.trankhanhan.site",
    ),
    ".trankhanhan.site",
  );
});

test("COOKIE_DOMAIN rejects empty junk", () => {
  assert.equal(normalizeCookieDomain(""), undefined);
  assert.equal(normalizeCookieDomain("localhost"), undefined);
  assert.equal(normalizeCookieDomain(null), undefined);
});
