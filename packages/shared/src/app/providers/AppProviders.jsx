"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useMemo, useState } from "react";
import { AppToaster } from "@/components/common/AppToaster";
import { NavigationIntentClickCapture } from "@/components/navigation/NavigationIntentClickCapture";
import { NavigationTopProgress } from "@/components/navigation/NavigationTopProgress";
import { ConfirmProvider } from "@/contexts/ConfirmProvider";
import { AuthBootstrap } from "@/features/auth/components/AuthBootstrap";
import { useAuthStore } from "@/features/auth/model/authSlice";
import {
  createQueryPersister,
  PERSIST_MAX_AGE_MS,
  shouldDehydrateQuery,
} from "@/lib/clientPersist/queryPersister.js";

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

function QueryClientShell({ queryClient, children }) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const persistOptions = useMemo(() => {
    if (userId == null) return null;
    return {
      persister: createQueryPersister(userId),
      maxAge: PERSIST_MAX_AGE_MS,
      buster: String(userId),
      dehydrateOptions: { shouldDehydrateQuery },
    };
  }, [userId]);

  if (persistOptions) {
    return (
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        {children}
      </PersistQueryClientProvider>
    );
  }
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export function AppProviders({ children }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientShell queryClient={queryClient}>
      <NavigationIntentClickCapture />
      <NavigationTopProgress />
      <ConfirmProvider>
        <AuthBootstrap>
          {children}
          <AppToaster />
        </AuthBootstrap>
      </ConfirmProvider>
    </QueryClientShell>
  );
}
