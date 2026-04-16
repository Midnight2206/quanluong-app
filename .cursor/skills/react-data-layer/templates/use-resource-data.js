import { useQuery } from "@tanstack/react-query";

/**
 * Baseline: wire `queryKey` to shared `queryKeys` and `queryFn` to `apiRequest`.
 * See skill `tanstack-react-query`.
 */
export const useResourceData = (params) => {
  const query = useQuery({
    queryKey: ["users", "list", params],
    queryFn: () => Promise.resolve([]),
    enabled: Boolean(params),
  });

  return {
    items: query.data ?? [],
    isLoading: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
  };
};
