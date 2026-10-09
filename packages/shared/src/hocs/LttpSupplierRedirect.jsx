"use client";

import { useEffect } from "react";
import {
  useAuthInitialized,
  useCurrentUser,
} from "@/features/auth/model/authSlice";
import { isLttpSupplierUser } from "@/utils/postLoginPath";
import { getSupplierAppOrigin } from "@/utils/supplierPortal";

export function LttpSupplierRedirect() {
  const initialized = useAuthInitialized();
  const user = useCurrentUser();

  useEffect(() => {
    if (!initialized || !isLttpSupplierUser(user)) {
      return;
    }
    window.location.replace(`${getSupplierAppOrigin()}/`);
  }, [initialized, user]);

  return null;
}
