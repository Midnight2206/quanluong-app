"use client";

import { MainLayout } from "@/layouts/MainLayout";
import { superadminPortalNavItems } from "@/features/navigation/navConfig";

export default function MainGroupLayout({ children }) {
  return (
    <MainLayout navItems={superadminPortalNavItems} showWorkingUnitScope={false}>
      {children}
    </MainLayout>
  );
}
