import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  buildCookieHeaderFromStore,
  getMidnightActor,
  isMidnightGateCookieValid,
  MIDNIGHT_GATE_COOKIE,
  MIDNIGHT_TAB_READ_CODES,
  midnightGrantsFromUser,
  userHasAnyPermission,
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
  const cookieHeader = buildCookieHeaderFromStore(cookieStore);
  const actor = await getMidnightActor(cookieHeader);
  if (actor.error || !userHasAnyPermission(actor.user, MIDNIGHT_TAB_READ_CODES)) {
    redirect("/");
  }

  const c = cookieStore.get(MIDNIGHT_GATE_COOKIE);
  const ok = isMidnightGateCookieValid(c?.value, cookieHeader);

  if (!ok) {
    return <MidnightGateForm />;
  }

  return <MidnightShell grants={midnightGrantsFromUser(actor.user)} />;
}
