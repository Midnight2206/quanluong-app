import "./globals.css";
import { AppProviders } from "@/app/providers/AppProviders";
import { QUANLUONG_MANIFEST_PATH, QUANLUONG_SITE_NAME, quanLuongIcons } from "@/lib/quanLuongPageMeta";
import { THEME_INIT_SCRIPT } from "@/utils/theme";
import { appFont } from "@/lib/appFont";

const siteName = QUANLUONG_SITE_NAME;
const defaultDescription =
  "Cổng nhà cung cấp LTTP — xem nhanh bảng đặt hàng theo ngày và đơn vị nhận.";
const defaultOgTitle = `${siteName} - Đặt hàng LTTP`;

export function generateMetadata() {
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
    manifest: QUANLUONG_MANIFEST_PATH,
    icons: quanLuongIcons(),
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
    <html lang="vi" className={appFont.variable} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
