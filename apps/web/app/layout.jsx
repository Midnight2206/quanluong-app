import "./globals.css";
import { AppProviders } from "@/app/providers/AppProviders";
import { QUANLUONG_SITE_NAME } from "@/lib/quanLuongPageMeta";

/** @param {string} url */
function iconMimeForUrl(url) {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".ico")) return "image/x-icon";
  if (path.endsWith(".webp")) return "image/webp";
  return undefined;
}

/** Logo tab: thay file `public/branding/site-icon.svg` (hoặc png/ico) hoặc đặt NEXT_PUBLIC_SITE_ICON. */
function brandingIconUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_ICON;
  if (raw != null && String(raw).trim() !== "") {
    return String(raw).trim();
  }
  return "/branding/site-icon.svg";
}

const siteName = QUANLUONG_SITE_NAME;
const defaultDescription =
  "Cổng làm việc đơn vị — lương và nhân sự, LTTP nhập–xuất, đặt hàng, báo cáo và phân quyền.";
const defaultOgTitle = `${siteName} - Trang chủ`;

export function generateMetadata() {
  const iconUrl = brandingIconUrl();
  const mime = iconMimeForUrl(iconUrl);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const metadataBase =
    siteUrl != null && String(siteUrl).trim() !== "" && /^https?:\/\//i.test(String(siteUrl).trim())
      ? new URL(String(siteUrl).trim())
      : undefined;

  return {
    ...(metadataBase ? { metadataBase } : {}),
    title: {
      default: `${siteName} - Trang chủ`,
      template: `${siteName} - %s`,
    },
    description: defaultDescription,
    applicationName: siteName,
    icons: {
      icon: mime ? [{ url: iconUrl, type: mime }] : [{ url: iconUrl }],
      shortcut: iconUrl,
      apple: [{ url: iconUrl }],
    },
    openGraph: {
      siteName,
      title: defaultOgTitle,
      description: defaultDescription,
      locale: "vi_VN",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: defaultOgTitle,
      description: defaultDescription,
    },
  };
}

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
