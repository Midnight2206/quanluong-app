import { cookies } from "next/headers";
import {
  buildCookieHeaderFromStore,
  isMidnightGateCookieValid,
  MIDNIGHT_GATE_COOKIE,
} from "../../lib/midnightSecretServer.js";
import { MidnightGateForm } from "./MidnightGateForm";
import { MidnightShell } from "./MidnightShell";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export const metadata = quanLuongPageMeta({
  title: "Báo cáo nội bộ",
  description: "Báo cáo ẩn nội bộ có mật cổng; không lập chỉ mục công khai.",
  robots: { index: false, follow: false },
});

export default async function MidnightSecretPage() {
  const cookieStore = await cookies();
  const c = cookieStore.get(MIDNIGHT_GATE_COOKIE);
  const ok = isMidnightGateCookieValid(c?.value, buildCookieHeaderFromStore(cookieStore));

  if (!ok) {
    return <MidnightGateForm />;
  }

  return <MidnightShell />;
}
