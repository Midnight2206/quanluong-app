import { DashboardLttpTabPage } from "@/pages/dashboard/DashboardTabPages";
import { getDashboardLttpSubPageMeta } from "@/lib/dashboardLttpSubPageMeta";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export async function generateMetadata({ params }) {
  const p = await params;
  const m = getDashboardLttpSubPageMeta(p?.lttpSub);
  return quanLuongPageMeta(m);
}

export default function DashboardLttpSubPage() {
  return <DashboardLttpTabPage />;
}
