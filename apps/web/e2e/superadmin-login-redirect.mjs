/**
 * Production-build check: superadmin login settles on /chon-cong.
 * Normal users settle on /dashboard. Guests on /dashboard land on /login once.
 *
 *   BASE_URL=http://127.0.0.1:3460 node apps/web/e2e/superadmin-login-redirect.mjs
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(join(dirname(fileURLToPath(import.meta.url)), "../../../package.json"))(
  "playwright",
);
const base = process.env.BASE_URL || "http://127.0.0.1:3460";

function userPayload(typeName) {
  return {
    success: true,
    data: {
      id: typeName === "superadmin" ? 1 : 2,
      email: `${typeName}@example.com`,
      emailVerified: true,
      type: { name: typeName },
      permissions: [],
    },
  };
}

async function runCase({ typeName, cookie, startPath, urlOk, forbid, text }) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  if (cookie) {
    await context.addCookies([
      {
        name: "ql.at",
        value: "test-access",
        url: base,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  }
  const page = await context.newPage();
  const urls = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      urls.push(frame.url());
    }
  });
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/auth/current-user") && typeName) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(userPayload(typeName)),
      });
      return;
    }
    if (url.includes("/auth/login") && typeName) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "set-cookie": "ql.at=test-access; Path=/; SameSite=Lax",
        },
        body: JSON.stringify(userPayload(typeName)),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: null }),
    });
  });

  await page.goto(`${base}${startPath}`, { waitUntil: "networkidle" });
  await page.waitForURL(urlOk, { timeout: 20000 });
  if (text) {
    await page.getByRole("heading", { name: text }).first().waitFor({ timeout: 20000 });
  }
  const unique = [...new Set(urls.map((url) => url.replace(base, "") || "/"))];
  const bounced = unique.filter((path) => forbid.some((item) => path.startsWith(item)));
  const final = page.url();
  await browser.close();
  return { unique, bounced, final };
}

const failures = [];

const superadminLogin = await runCase({
  typeName: "superadmin",
  cookie: true,
  startPath: "/login",
  urlOk: /\/chon-cong$/,
  forbid: ["/dashboard"],
});
if (superadminLogin.unique.length > 4) {
  failures.push(`superadmin /login navigations ${superadminLogin.unique.join(" -> ")}`);
}
if (!superadminLogin.final.endsWith("/chon-cong")) {
  failures.push(`superadmin /login ended at ${superadminLogin.final}`);
}

const superadminDash = await runCase({
  typeName: "superadmin",
  cookie: true,
  startPath: "/dashboard",
  urlOk: /\/chon-cong$/,
  forbid: [],
});
if (superadminDash.unique.length > 4 || !superadminDash.final.endsWith("/chon-cong")) {
  failures.push(`superadmin /dashboard ${superadminDash.unique.join(" -> ")} final ${superadminDash.final}`);
}

const unitLogin = await runCase({
  typeName: "admin",
  cookie: true,
  startPath: "/login",
  urlOk: /\/dashboard/,
  forbid: ["/chon-cong"],
});
const unitReturnedToLogin = unitLogin.unique.filter((path) => path.startsWith("/login")).length > 1;
if (unitReturnedToLogin || unitLogin.bounced.length || unitLogin.unique.length > 5 || !unitLogin.final.includes("/dashboard")) {
  failures.push(`unit /login ${unitLogin.unique.join(" -> ")} final ${unitLogin.final}`);
}

const signedInHome = await runCase({
  typeName: "superadmin",
  cookie: true,
  startPath: "/",
  urlOk: /\/$/,
  forbid: ["/dashboard", "/chon-cong", "/login"],
  text: "Midnight",
});
if (!signedInHome.final.endsWith("/") || signedInHome.unique.some((path) => path.startsWith("/dashboard"))) {
  failures.push(`signed-in / ${signedInHome.unique.join(" -> ")} final ${signedInHome.final}`);
}

const guest = await runCase({
  typeName: null,
  cookie: false,
  startPath: "/dashboard",
  urlOk: /\/login/,
  forbid: ["/dashboard"],
});
const guestDashHits = guest.unique.filter((path) => path.startsWith("/dashboard")).length;
if (guestDashHits > 1 || !guest.final.includes("/login")) {
  failures.push(`guest /dashboard ${guest.unique.join(" -> ")} final ${guest.final}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("superadmin login path settled");
console.log("superadmin login", superadminLogin.unique.join(" -> "));
console.log("superadmin dashboard", superadminDash.unique.join(" -> "));
console.log("unit login", unitLogin.unique.join(" -> "));
console.log("guest dashboard", guest.unique.join(" -> "));
console.log("signed-in home", signedInHome.unique.join(" -> "));
