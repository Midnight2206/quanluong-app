import Link from "next/link";

export function SupplierHomePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 py-6 sm:px-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">LTTP</p>
        <h1 className="text-2xl font-semibold text-foreground">Cổng nhà cung cấp</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/dat-hang"
          className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Vào đặt hàng
        </Link>
        <Link
          href="/so-cong-no"
          className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground"
        >
          Sổ công nợ
        </Link>
      </div>
    </div>
  );
}
