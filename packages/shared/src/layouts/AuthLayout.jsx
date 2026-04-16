import { AppBrand } from "@/components/common/AppBrand";

export function AuthLayout({ children }) {
  return (
    <div className="page-shell flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-[1.75rem] border bg-card/90 p-8 shadow-float">
        <AppBrand />
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
