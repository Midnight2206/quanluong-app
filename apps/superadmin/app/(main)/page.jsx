import { cookies } from "next/headers";
import { Suspense } from "react";
import { HomePage } from "@/pages/home/HomePage";
import {
  LANDING_LANG_BOOT_SCRIPT,
  LANDING_LOCALE_COOKIE,
  getLandingCopy,
  landingRouteMetadata,
  resolveLandingLocale,
} from "@/pages/home/landingCopy";

export async function generateMetadata() {
  const jar = await cookies();
  return landingRouteMetadata(jar.get(LANDING_LOCALE_COOKIE)?.value);
}

export default async function HomeRoutePage() {
  const jar = await cookies();
  const locale = resolveLandingLocale(jar.get(LANDING_LOCALE_COOKIE)?.value);
  const copy = getLandingCopy(locale);
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: LANDING_LANG_BOOT_SCRIPT }} />
      <Suspense fallback={<p className="text-sm text-muted-foreground">{copy.loading}</p>}>
        <HomePage initialLocale={locale} />
      </Suspense>
    </>
  );
}
