"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { startNavigationIntent } from "@/components/navigation/navigationIntentStore";

/**
 * Thay thế `<Navigate />` của React Router trong App Router.
 */
export function ClientRedirect({ href, replace = true }) {
  const router = useRouter();
  useEffect(() => {
    startNavigationIntent();
    if (replace) {
      router.replace(href);
    } else {
      router.push(href);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- router từ next/navigation không đưa vào deps (tránh lặp replace)
  }, [href, replace]);
  return null;
}
