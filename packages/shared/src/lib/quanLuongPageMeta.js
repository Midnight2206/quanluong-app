/** Tên thương hiệu thống nhất cho `<title>`, OG và Twitter. */
export const QUANLUONG_SITE_NAME = "Quân lương";

/** Slogan dưới tên thương hiệu trên header / màn hình đăng nhập. */
export const QUANLUONG_SITE_SLOGAN = "Hiện đại hoá công tác quản lý quân nhu";

/** Logo đầy đủ (có padding). Mỗi app phục vụ file này từ `public/branding/`. */
export const QUANLUONG_BRAND_LOGO_SRC = "/branding/logo.png";

/** Logo crop chặt cho vòng Midnight trên header / auth. */
export const QUANLUONG_BRAND_LOGO_MARK_SRC = "/branding/logo-mark.png";

/** Web app manifest (tên sản phẩm + icon Midnight). */
export const QUANLUONG_MANIFEST_PATH = "/branding/site.webmanifest";

const BRAND_ICON_ICO = "/branding/favicon.ico";
const BRAND_ICON_64 = "/branding/favicon-64x64.png";
const BRAND_ICON_48 = "/branding/favicon-48x48.png";
const BRAND_ICON_32 = "/branding/favicon-32x32.png";
const BRAND_ICON_16 = "/branding/favicon-16x16.png";
const BRAND_ICON_APPLE = "/branding/apple-touch-icon.png";

/** @param {string} url */
function iconMimeForUrl(url) {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".ico")) return "image/x-icon";
  if (path.endsWith(".webp")) return "image/webp";
  return undefined;
}

/**
 * Icon tab / Apple Touch. `NEXT_PUBLIC_SITE_ICON` vẫn ghi đè bằng một URL.
 * @returns {import("next").Metadata["icons"]}
 */
export function quanLuongIcons() {
  const raw = process.env.NEXT_PUBLIC_SITE_ICON;
  if (raw != null && String(raw).trim() !== "") {
    const iconUrl = String(raw).trim();
    const mime = iconMimeForUrl(iconUrl);
    return {
      icon: mime ? [{ url: iconUrl, type: mime }] : [{ url: iconUrl }],
      shortcut: iconUrl,
      apple: [{ url: iconUrl }],
    };
  }
  return {
    // Ưu tiên PNG lớn hơn trước — tab/bookmark hiện đại chọn kích thước khớp denser DPR.
    icon: [
      { url: BRAND_ICON_64, sizes: "64x64", type: "image/png" },
      { url: BRAND_ICON_48, sizes: "48x48", type: "image/png" },
      { url: BRAND_ICON_32, sizes: "32x32", type: "image/png" },
      { url: BRAND_ICON_16, sizes: "16x16", type: "image/png" },
      { url: BRAND_ICON_ICO, sizes: "any", type: "image/x-icon" },
    ],
    shortcut: BRAND_ICON_ICO,
    apple: [{ url: BRAND_ICON_APPLE, sizes: "180x180", type: "image/png" }],
  };
}

/**
 * Metadata chuẩn cho một trang: segment `title` khớp template root `Quân lương - %s`;
 * OG/Twitter nhận title đầy đủ.
 *
 * @param {{ title: string; description: string; locale?: "vi" | "en"; robots?: import("next").Metadata["robots"] }} opts
 * @returns {import("next").Metadata}
 */
export function quanLuongPageMeta(opts) {
  const docTitle = `${QUANLUONG_SITE_NAME} - ${opts.title}`;
  const ogLocale = opts.locale === "en" ? "en_US" : "vi_VN";
  /** @type {import("next").Metadata} */
  const out = {
    title: opts.title,
    description: opts.description,
    openGraph: {
      title: docTitle,
      description: opts.description,
      locale: ogLocale,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: docTitle,
      description: opts.description,
    },
  };
  if (opts.robots != null) {
    out.robots = opts.robots;
  }
  return out;
}
