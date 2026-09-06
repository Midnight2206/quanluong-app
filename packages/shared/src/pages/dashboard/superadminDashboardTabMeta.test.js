import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { DASHBOARD_SUPERADMIN_TAB_META } from "./superadminDashboardTabMeta.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function buildPortalNavItems(meta) {
  return meta.map((t) => ({
    to: `/dashboard/${t.path}`,
    label: t.shortLabel,
    title: t.label,
    icon: t.icon,
    section: t.section,
    requiresAuth: true,
    routeAccessKey: t.routeAccessKey,
  }));
}

test("superadmin tab meta has section shortLabel icon for 8 paths", () => {
  assert.equal(DASHBOARD_SUPERADMIN_TAB_META.length, 8);
  const paths = DASHBOARD_SUPERADMIN_TAB_META.map((t) => t.path);
  assert.deepEqual(paths, [
    "units",
    "users",
    "pending-registrations",
    "lttp-groups",
    "meal-allowance-rates",
    "permission-matrix",
    "permission-descriptions",
    "chung-tu-pdf-templates",
  ]);
  for (const t of DASHBOARD_SUPERADMIN_TAB_META) {
    assert.ok(t.section);
    assert.ok(t.shortLabel);
    assert.ok(t.icon && (typeof t.icon === "function" || typeof t.icon.render === "function"));
    assert.ok(t.routeAccessKey);
    assert.ok(t.label);
  }
  assert.equal(DASHBOARD_SUPERADMIN_TAB_META[0].section, "Hệ thống");
  assert.equal(DASHBOARD_SUPERADMIN_TAB_META[3].section, "Danh mục");
  assert.equal(DASHBOARD_SUPERADMIN_TAB_META[5].section, "Quyền");
  assert.equal(DASHBOARD_SUPERADMIN_TAB_META[7].section, "Chứng từ");
});

test("superadminPortalNavItems is dashboard-only from meta", () => {
  const superadminPortalNavItems = buildPortalNavItems(DASHBOARD_SUPERADMIN_TAB_META);
  assert.equal(superadminPortalNavItems.length, 8);
  for (const item of superadminPortalNavItems) {
    assert.match(item.to, /^\/dashboard\//);
    assert.ok(item.section);
    assert.ok(item.title);
    assert.equal(item.requiresAuth, true);
  }
  const blob = JSON.stringify(superadminPortalNavItems.map((i) => i.to));
  assert.doesNotMatch(blob, /lttp-nhap-xuat/);
  assert.doesNotMatch(blob, /so-sach-bep-an/);
  assert.equal(
    superadminPortalNavItems.some((i) => i.to === "/users"),
    false,
  );
  const navSrc = readFileSync(join(root, "src/features/navigation/navConfig.js"), "utf8");
  assert.doesNotMatch(navSrc, /getMainAppOrigin\(\)/);
  assert.match(navSrc, /DASHBOARD_SUPERADMIN_TAB_META/);
});
