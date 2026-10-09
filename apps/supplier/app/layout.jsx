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

function brandingIconUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_ICON;
  if (raw != null && String(raw).trim() !== "") {
    return String(raw).trim();
  }
  return "/branding/site-icon.svg";
}

const siteName = QUANLUONG_SITE_NAME;
const defaultDescription =
  "Cổng nhà cung cấp LTTP — xem nhanh bảng đặt hàng theo ngày và đơn vị nhận.";
const defaultOgTitle = `${siteName} - Đặt hàng LTTP`;

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
      default: `${siteName} - Đặt hàng LTTP`,
      template: `${siteName} - %s`,
    },
    description: defaultDescription,
    applicationName: `${siteName} (Nhà cung cấp LTTP)`,
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
    <html lang="vi" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{if(localStorage.getItem("quanluong-ui:theme")==="dark"){document.documentElement.classList.add("dark")}}catch(e){}})()',
          }}
        />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
