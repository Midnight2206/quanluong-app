import { AppProviders } from "@/app/providers/AppProviders";

/** @deprecated Dùng Next.js `apps/superadmin`. */
export default function SuperadminApp() {
  return (
    <AppProviders>
      <p className="p-6 text-sm text-muted-foreground">
        Chạy cổng superadmin qua Next.js:{" "}
        <code className="rounded bg-muted px-1 py-0.5">npm run dev:superadmin</code>
      </p>
    </AppProviders>
  );
}
