/** Trang Next thật của apps/web và apps/superadmin. Không gồm apps/supplier. */

export const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740 },
  { name: "390x844", width: 390, height: 844 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1440x900", width: 1440, height: 900, desktop: true },
];

const LTTP_SUBS = [
  "food-groups",
  "commodities",
  "suppliers",
  "tables",
  "effective",
  "newtable",
  "import",
];

const webPrivate = [
  "/dashboard",
  "/dashboard/units",
  "/dashboard/users",
  "/dashboard/job-titles",
  "/dashboard/lttp",
  ...LTTP_SUBS.map((sub) => `/dashboard/lttp/${sub}`),
  "/dashboard/lttp-groups",
  "/dashboard/meal-allowance-rates",
  "/dashboard/pending-registrations",
  "/dashboard/permission-descriptions",
  "/dashboard/permission-matrix",
  "/dashboard/audit-logs",
  "/chungtuquyettoan",
  "/lttp-nhap-xuat",
  "/lttp-nhap-xuat/ordering-lttp",
  "/meal-roster",
  "/so-sach-bep-an",
  "/profile",
  "/settings",
  "/users",
  "/dev/document-service",
];

const webPublic = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/login/zalo",
  "/chon-cong",
  "/verify-email",
  "/verify-email/resend",
  "/midnight-secret",
];

const superadminPrivate = [
  "/dashboard",
  "/dashboard/units",
  "/dashboard/users",
  "/dashboard/pending-registrations",
  "/dashboard/lttp-groups",
  "/dashboard/meal-allowance-rates",
  "/dashboard/permission-matrix",
  "/dashboard/permission-descriptions",
  "/dashboard/chung-tu-pdf-templates",
  "/dashboard/backup",
  "/dashboard/infra",
  "/dashboard/ba-profiles",
  "/dashboard/audit-logs",
  "/profile",
  "/settings",
];

const superadminPublic = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/verify-email/resend",
];

export const APPS = [
  {
    id: "web",
    port: 3000,
    workspace: "@quanluong/web",
    persona: "admin",
    pages: [...webPublic, ...webPrivate],
  },
  {
    id: "superadmin",
    port: 3001,
    workspace: "@quanluong/superadmin",
    persona: "superadmin",
    pages: [...superadminPublic, ...superadminPrivate],
  },
];

export function shotName(appId, pagePath, viewportName) {
  const slug = pagePath === "/" ? "home" : pagePath.replace(/^\//, "").replaceAll("/", "__");
  return `${appId}__${slug}__${viewportName}.png`;
}
