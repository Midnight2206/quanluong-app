/**
 * Skeleton trong khối AuthLayout khi chuyển giữa các trang (auth).
 */
export function AuthRouteLoading() {
  return (
    <div
      className="space-y-5 pt-1 motion-safe:opacity-[0.97]"
      aria-busy="true"
      aria-label="Đang tải"
    >
      <div className="h-8 w-3/4 max-w-[220px] animate-pulse rounded-lg bg-muted/80" />
      <div className="space-y-3">
        <div className="h-11 w-full animate-pulse rounded-xl bg-muted/60" />
        <div className="h-11 w-full animate-pulse rounded-xl bg-muted/55" />
      </div>
      <div className="h-11 w-full animate-pulse rounded-xl bg-primary/25" />
      <div className="h-4 w-2/3 animate-pulse rounded-md bg-muted/50" />
    </div>
  );
}
