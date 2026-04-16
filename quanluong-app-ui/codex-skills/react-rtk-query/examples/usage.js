import { useGetUsersQuery } from "../templates/baseApi";

export const UsersList = () => {
  const { data = [], isLoading, isError } = useGetUsersQuery();

  if (isLoading) {
    return <p>Loading...</p>;
  }

  if (isError) {
    return <p>Could not load users.</p>;
  }

  return <pre>{JSON.stringify(data, null, 2)}</pre>;
};
