import "./globals.css";
import { AppProviders } from "@/app/providers/AppProviders";

export const metadata = {
  title: "Quản trị hệ thống",
  description: "Superadmin — Quản lương",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
