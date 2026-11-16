"use client";

import { SupplierOnlyRoute } from "@/hocs/SupplierOnlyRoute";

/** Chỉ tài khoản `lttp_supplier` — kế thừa MainLayout từ `(private)`. */
export default function NccPrivateLayout({ children }) {
  return <SupplierOnlyRoute>{children}</SupplierOnlyRoute>;
}
