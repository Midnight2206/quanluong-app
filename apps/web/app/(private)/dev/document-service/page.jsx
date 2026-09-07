import { DocumentDevTestPage } from "@/pages/document-dev/DocumentDevTestPage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Document service test",
  description: "Trang tạm test luồng FE → Node → Python document microservice.",
  robots: { index: false, follow: false },
});

export default function DocumentDevRoutePage() {
  return <DocumentDevTestPage />;
}
