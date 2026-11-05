/** Tên thương hiệu thống nhất cho `<title>`, OG và Twitter. */
export const QUANLUONG_SITE_NAME = "Quân lương";

/** Logo trong suốt trên header / màn hình đăng nhập. Mỗi app phục vụ file này từ `public/branding/`. */
export const QUANLUONG_BRAND_LOGO_SRC = "/branding/logo.png";

/** Web app manifest (tên sản phẩm + icon Midnight). */
export const QUANLUONG_MANIFEST_PATH = "/branding/site.webmanifest";

const BRAND_ICON_ICO = "/branding/favicon.ico";
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
    icon: [
      { url: BRAND_ICON_ICO, sizes: "any", type: "image/x-icon" },
      { url: BRAND_ICON_32, sizes: "32x32", type: "image/png" },
      { url: BRAND_ICON_16, sizes: "16x16", type: "image/png" },
    ],
    shortcut: BRAND_ICON_ICO,
    apple: [{ url: BRAND_ICON_APPLE, sizes: "180x180", type: "image/png" }],
  };
}

/**
 * Metadata chuẩn cho một trang: segment `title` khớp template root `Quân lương - %s`;
 * OG/Twitter nhận title đầy đủ.
 *
 * @param {{ title: string; description: string; robots?: import("next").Metadata["robots"] }} opts
 * @returns {import("next").Metadata}
 */
export function quanLuongPageMeta(opts) {
  const docTitle = `${QUANLUONG_SITE_NAME} - ${opts.title}`;
  /** @type {import("next").Metadata} */
  const out = {
    title: opts.title,
    description: opts.description,
    openGraph: {
      title: docTitle,
      description: opts.description,
      locale: "vi_VN",
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
