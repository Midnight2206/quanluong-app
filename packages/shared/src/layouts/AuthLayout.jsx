import { AppBrand } from "@/components/common/AppBrand";
import { UnifiedPageScrollRoot } from "@/hocs/withUnifiedPageScroll";

export function AuthLayout({ children }) {
  return (
    <div
      data-page-scroll-owner="true"
      className="page-shell overflow-y-auto overscroll-y-contain"
    >
      <UnifiedPageScrollRoot className="flex min-h-full items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-panel sm:p-8">
          <AppBrand />
          <div className="mt-8">{children}</div>
        </div>
      </UnifiedPageScrollRoot>
    </div>
  );
}
