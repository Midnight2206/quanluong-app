import { EntertainmentPage } from "@/pages/entertainment/EntertainmentPage";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Giai tri",
});

export default function EntertainmentRoutePage() {
  return <EntertainmentPage />;
}
