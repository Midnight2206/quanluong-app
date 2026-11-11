import "./globals.css";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
import { AppProviders } from "@/app/providers/AppProviders";
import { LttpSupplierRedirect } from "@/hocs/LttpSupplierRedirect";
import { QUANLUONG_MANIFEST_PATH, QUANLUONG_SITE_NAME, quanLuongIcons } from "@/lib/quanLuongPageMeta";
import { THEME_INIT_SCRIPT } from "@/utils/theme";
import { appFont, displayFont } from "@/lib/appFont";

const siteName = QUANLUONG_SITE_NAME;
const defaultDescription =
  "Midnight — web app, website và firmware. Quân lương: quản lý quân nhu, LTTP, sổ sách và phân quyền trên production.";
const defaultOgTitle = `${siteName} - Midnight`;

export function generateMetadata() {
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
    other: {
      "zalo-platform-site-verification": "S--FSAx38YOhnv47qFGs2o-BvJB3_JvkDpas",
    },
  };
}

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={`${appFont.variable} ${displayFont.variable}`} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <AppProviders>
          <LttpSupplierRedirect />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
