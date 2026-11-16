import Link from "next/link";
import {
  SUPPLIER_INVOICE_PATH,
  SUPPLIER_LEDGER_PATH,
  SUPPLIER_ORDER_PATH,
} from "@/utils/supplierPortal";

/** Legacy landing — app chính dùng trang chủ gốc `/`. */
export function SupplierHomePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 py-6 sm:px-4 lg:max-w-none">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">LTTP</p>
        <h1 className="text-xl font-semibold text-foreground">Cổng nhà cung cấp</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={SUPPLIER_ORDER_PATH}
          className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Đặt hàng
        </Link>
        <Link
          href={SUPPLIER_LEDGER_PATH}
          className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground"
        >
          Sổ công nợ
        </Link>
        <Link
          href={SUPPLIER_INVOICE_PATH}
          className="inline-flex h-10 items-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground"
        >
          Hoá đơn hằng ngày
        </Link>
      </div>
    </div>
  );
}
