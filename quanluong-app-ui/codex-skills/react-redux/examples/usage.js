import { useDispatch, useSelector } from "react-redux";
import { selectUsersFilter, setUserFilter } from "../templates/module";

export const UsersFilterInput = () => {
  const dispatch = useDispatch();
  const filter = useSelector(selectUsersFilter);

  return (
    <input
      value={filter}
      onChange={(event) => dispatch(setUserFilter(event.target.value))}
    />
  );
};
