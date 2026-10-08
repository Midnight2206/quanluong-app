"use client";

import { SupplierOnlyRoute } from "@/hocs/SupplierOnlyRoute";

export default function PrivateGroupLayout({ children }) {
  return <SupplierOnlyRoute>{children}</SupplierOnlyRoute>;
}
