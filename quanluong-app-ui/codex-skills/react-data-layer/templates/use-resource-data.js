import { useGetUsersQuery } from "../../react-rtk-query/templates/baseApi";

export const useResourceData = (params) => {
  const query = useGetUsersQuery(params);

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
  };
};
