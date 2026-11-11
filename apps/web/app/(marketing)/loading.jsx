import { cookies } from "next/headers";
import { getMidnightCopy } from "@/lib/midnightLandingCopy";
import { MIDNIGHT_LOCALE_COOKIE, normalizeMidnightLocale } from "@/lib/midnightLocale";

export default async function MarketingLoading() {
  const jar = await cookies();
  const locale = normalizeMidnightLocale(jar.get(MIDNIGHT_LOCALE_COOKIE)?.value);
  return <p className="p-8 text-center text-sm text-muted-foreground">{getMidnightCopy(locale).loading}</p>;
}
