"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { TargetUnitScopeProvider } from "@/contexts/TargetUnitScopeContext";
import { useCurrentUser } from "@/features/auth/model/authSlice";
import { mainNavItems, superadminNavItems } from "@/features/navigation/navConfig";
import { AppHeader } from "@/layouts/components/AppHeader";
import { AppSidebar } from "@/layouts/components/AppSidebar";
import { ChatDockProvider } from "@/contexts/ChatDockContext";
import { EmailVerificationDock } from "@/layouts/components/EmailVerificationDock";
import { MessengerChatDock } from "@/layouts/components/MessengerChatDock";
import { WorkingUnitScopeBar } from "@/layouts/components/WorkingUnitScopeBar";
import { UnifiedPageScrollRoot } from "@/hocs/withUnifiedPageScroll";

/**
 * @param {{ children: import('react').ReactNode, navItems?: typeof mainNavItems }} props
 */
export function MainLayout({ children, navItems: navItemsProp }) {
  const router = useRouter();
  const user = useCurrentUser();
  const isSuperadmin = user?.type?.name === "superadmin";
  const sidebarItems = navItemsProp ?? (isSuperadmin ? superadminNavItems : mainNavItems);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      for (const item of sidebarItems) {
        if (cancelled) {
          return;
        }
        if (item.external) {
          continue;
        }
        const to = item.to;
        if (typeof to !== "string" || !to.startsWith("/")) {
          continue;
        }
        try {
          router.prefetch(to);
        } catch {
          /* ignore */
        }
      }
    };
    let idleId;
    let timeoutId;
    if (typeof requestIdleCallback !== "undefined") {
      idleId = requestIdleCallback(run, { timeout: 2500 });
    } else {
      timeoutId = window.setTimeout(run, 0);
    }
    return () => {
      cancelled = true;
      if (idleId != null) {
        cancelIdleCallback(idleId);
      }
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [router, sidebarItems]);

  return (
    <ChatDockProvider>
      <div className="page-shell flex min-h-0 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AppHeader />
          <TargetUnitScopeProvider>
            <WorkingUnitScopeBar />
            <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
              <AppSidebar items={sidebarItems} />
              <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 pt-3 pb-[max(0.75rem,calc(4.25rem+env(safe-area-inset-bottom,0px)))] print:h-auto print:min-h-0 print:overflow-visible sm:px-4 sm:pt-4 sm:pb-[max(1rem,calc(4.25rem+env(safe-area-inset-bottom,0px)))] lg:px-6 lg:py-5 lg:pb-5">
                <div
                  data-page-scroll-owner="true"
                  className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch] touch-pan-y print:h-auto print:min-h-0 print:overflow-visible"
                >
                  <UnifiedPageScrollRoot className="min-h-full">
                    {children}
                  </UnifiedPageScrollRoot>
                </div>
              </main>
            </div>
          </TargetUnitScopeProvider>
        </div>
        <EmailVerificationDock />
        <MessengerChatDock />
      </div>
    </ChatDockProvider>
  );
}
