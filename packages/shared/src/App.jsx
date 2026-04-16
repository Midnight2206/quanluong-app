import { AppProviders } from "@/app/providers/AppProviders";

/** @deprecated Dùng Next.js `apps/web`; Vite entry chỉ giữ để tương thích script cũ. */
export default function App() {
  return (
    <AppProviders>
      <p className="p-6 text-sm text-muted-foreground">
        Chạy UI qua Next.js từ thư mục gốc monorepo:{" "}
        <code className="rounded bg-muted px-1 py-0.5">npm run dev:web</code>
      </p>
    </AppProviders>
  );
}
