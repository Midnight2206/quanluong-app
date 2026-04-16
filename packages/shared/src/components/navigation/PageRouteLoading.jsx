/**
 * Fallback nội dung khu vực main (dashboard) khi Next.js đang tải segment route.
 * Dùng trong `app/.../loading.jsx` — layout (header/sidebar) giữ nguyên.
 */
export function PageRouteLoading() {
  return (
    <div
      className="space-y-6 pb-8 motion-safe:opacity-[0.97] motion-reduce:opacity-100"
      aria-busy="true"
      aria-label="Đang tải trang"
    >
      <div className="h-9 w-48 max-w-[60%] animate-pulse rounded-xl bg-muted/80" />
      <div className="space-y-3 rounded-2xl border border-border/50 bg-card/50 p-5 shadow-soft">
        <div className="h-4 max-w-xl animate-pulse rounded-md bg-muted/70" />
        <div className="h-4 max-w-lg animate-pulse rounded-md bg-muted/60" />
        <div className="h-36 w-full animate-pulse rounded-xl bg-muted/50" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((key) => (
          <div
            key={key}
            className="h-28 animate-pulse rounded-2xl border border-border/40 bg-muted/35"
          />
        ))}
      </div>
    </div>
  );
}
