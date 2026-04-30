export function AppBrand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f26f21] text-sm font-bold text-white shadow-soft">
        QL
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          Quân lương
        </p>
        <p className="mt-1 text-sm font-semibold">
          Quản lý quân lương hiệu quả
        </p>
      </div>
    </div>
  );
}
