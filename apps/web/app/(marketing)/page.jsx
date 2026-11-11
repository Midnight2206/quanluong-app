import { cookies } from "next/headers";
import { Suspense } from "react";
import { MidnightLandingPage } from "@/pages/home/MidnightLandingPage";
import { getMidnightCopy, midnightLandingMeta } from "@/lib/midnightLandingCopy";
import { MIDNIGHT_LOCALE_COOKIE, normalizeMidnightLocale } from "@/lib/midnightLocale";
import { quanLuongPageMeta } from "@/lib/quanLuongPageMeta";

export async function generateMetadata() {
  const jar = await cookies();
  const locale = normalizeMidnightLocale(jar.get(MIDNIGHT_LOCALE_COOKIE)?.value);
  const meta = midnightLandingMeta(locale);
  return quanLuongPageMeta({
    title: meta.title,
    description: meta.description,
    locale,
  });
}

export default async function HomeRoutePage() {
  const jar = await cookies();
  const locale = normalizeMidnightLocale(jar.get(MIDNIGHT_LOCALE_COOKIE)?.value);
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-muted-foreground">{getMidnightCopy(locale).loading}</p>}>
      <MidnightLandingPage />
    </Suspense>
  );
}
