"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AppToaster } from "@/components/common/AppToaster";
import { NavigationIntentClickCapture } from "@/components/navigation/NavigationIntentClickCapture";
import { NavigationTopProgress } from "@/components/navigation/NavigationTopProgress";
import { ConfirmProvider } from "@/contexts/ConfirmProvider";
import { AuthBootstrap } from "@/features/auth/components/AuthBootstrap";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 120_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

export function AppProviders({ children }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationIntentClickCapture />
      <NavigationTopProgress />
      <ConfirmProvider>
        <AuthBootstrap>
          {children}
          <AppToaster />
        </AuthBootstrap>
      </ConfirmProvider>
    </QueryClientProvider>
  );
}
