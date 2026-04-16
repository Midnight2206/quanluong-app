"use client";

import { useMutation } from "@tanstack/react-query";
import { withUnwrap } from "@/services/apiRequest";

export function useWrappedMutation(config) {
  const m = useMutation(config);
  const trigger = (arg) => withUnwrap(m.mutateAsync(arg));
  return [trigger, { isLoading: m.isPending, reset: m.reset, error: m.error, ...m }];
}
