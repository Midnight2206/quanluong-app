export const USER_SET_FILTER = "users/setFilter";
export const USER_RESET_FILTER = "users/resetFilter";

const initialState = {
  filter: "",
};

export const setUserFilter = (value) => ({
  type: USER_SET_FILTER,
  payload: value,
});

export const resetUserFilter = () => ({
  type: USER_RESET_FILTER,
});

export const usersReducer = (state = initialState, action) => {
  switch (action.type) {
    case USER_SET_FILTER:
      return {
        ...state,
        filter: action.payload,
      };

    case USER_RESET_FILTER:
      return initialState;

    default:
      return state;
  }
};

export const selectUsersFilter = (state) => state.users.filter;
