"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { useGetChungTuQuyetToanHealthQuery } from "@/features/chung-tu-quyet-toan/api/chungTuQuyetToanApi";

export function ChungTuQuyetToanPage() {
  const { data, isLoading, isFetching, error } = useGetChungTuQuyetToanHealthQuery();
  const health = data?.data ?? null;

  return (
    <section className="min-w-0 space-y-3 pb-6">
      <div className="space-y-1">
        <h1 className="text-base font-semibold tracking-tight sm:text-lg">Chứng từ quyết toán</h1>
        <p className="text-[11px] text-muted-foreground">
          Trang mới cho nghiệp vụ chứng từ quyết toán, truy cập trực tiếp tại <span className="font-mono">/chungtuquyettoan</span>.
        </p>
      </div>

      <Card className="shadow-soft">
        <CardContent className="space-y-2 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">API riêng</p>
          {isLoading || isFetching ? <p className="text-sm text-muted-foreground">Đang kiểm tra kết nối API…</p> : null}
          {error ? (
            <p className="text-sm text-destructive">
              {typeof error?.data?.message === "string" ? error.data.message : "Không gọi được API chứng từ quyết toán."}
            </p>
          ) : null}
          {!isLoading && !isFetching && !error ? (
            <pre className="overflow-auto rounded-md border border-border/70 bg-muted/30 p-3 text-xs text-foreground">
              {JSON.stringify(health, null, 2)}
            </pre>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
