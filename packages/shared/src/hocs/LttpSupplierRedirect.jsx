"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  useAuthInitialized,
  useCurrentUser,
} from "@/features/auth/model/authSlice";
import { isLttpSupplierUser } from "@/utils/postLoginPath";
import { isSupplierAppPath, SUPPLIER_DEFAULT_HOME } from "@/utils/supplierPortal";

/** Route đơn vị — NCC không dùng, đẩy về trang chủ gốc. */
const UNIT_ONLY_PREFIXES = [
  "/dashboard",
  "/lttp-nhap-xuat",
  "/chungtuquyettoan",
  "/users",
  "/so-sach-bep-an",
  "/meal-roster",
  "/midnight-secret",
];

function isUnitOnlyPath(pathname) {
  const p = String(pathname || "");
  return UNIT_ONLY_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

/**
 * `lttp_supplier`: cho phép trang chủ `/`, profile, path NCC;
 * chỉ đẩy khỏi route đơn vị về `/`.
 */
export function LttpSupplierRedirect() {
  const initialized = useAuthInitialized();
  const user = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!initialized || !isLttpSupplierUser(user)) {
      return;
    }
    if (!isUnitOnlyPath(pathname)) {
      return;
    }
    if (isSupplierAppPath(pathname)) {
      return;
    }
    router.replace(SUPPLIER_DEFAULT_HOME);
  }, [initialized, user, pathname, router]);

  return null;
}
