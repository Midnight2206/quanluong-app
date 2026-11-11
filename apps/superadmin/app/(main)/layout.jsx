"use client";

import { usePathname } from "next/navigation";
import { MainLayout } from "@/layouts/MainLayout";
import { superadminPortalNavItems } from "@/features/navigation/navConfig";

export default function MainGroupLayout({ children }) {
  const pathname = usePathname();
  if (pathname === "/") {
    return children;
  }
  return (
    <MainLayout navItems={superadminPortalNavItems} showWorkingUnitScope={false}>
      {children}
    </MainLayout>
  );
}
