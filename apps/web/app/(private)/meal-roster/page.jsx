import { redirect } from "next/navigation";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Chấm cơm",
  description: "Chuyển hướng tới Sổ sách bếp ăn.",
});

export default function MealRosterRedirectPage() {
  redirect("/so-sach-bep-an?tab=guaranty");
}
