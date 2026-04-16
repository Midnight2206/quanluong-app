import { useResourceData } from "../templates/use-resource-data";

export const useUsersScreenData = (params) => {
  const { items, isLoading, isFetching, isError, error } =
    useResourceData(params);

  return {
    rows: items,
    isLoading,
    isFetching,
    isError,
    error,
    isEmpty: !isLoading && !isError && items.length === 0,
  };
};
