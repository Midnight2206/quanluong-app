import { cookies } from "next/headers";
import { MarketingLayout } from "@/layouts/MarketingLayout";
import { MIDNIGHT_LOCALE_COOKIE, normalizeMidnightLocale } from "@/lib/midnightLocale";

export default async function MarketingGroupLayout({ children }) {
  const jar = await cookies();
  const initialLocale = normalizeMidnightLocale(jar.get(MIDNIGHT_LOCALE_COOKIE)?.value);
  return <MarketingLayout initialLocale={initialLocale}>{children}</MarketingLayout>;
}
