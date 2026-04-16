import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchUsers,
  selectUsers,
  selectUsersStatus,
} from "../templates/slice";

export const UsersList = () => {
  const dispatch = useDispatch();
  const users = useSelector(selectUsers);
  const status = useSelector(selectUsersStatus);

  useEffect(() => {
    if (status === "idle") {
      dispatch(fetchUsers());
    }
  }, [dispatch, status]);

  if (status === "loading") {
    return <p>Loading...</p>;
  }

  return <pre>{JSON.stringify(users, null, 2)}</pre>;
};
